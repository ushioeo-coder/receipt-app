import { prisma } from '@/lib/prisma'
import { detectReceipt, extractReceiptData, classifyAccount } from '@/lib/gemini'
import { supabaseAdmin } from '@/lib/supabase'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'

type ProgressStep = 'frame_extract' | 'detect' | 'ocr' | 'classify' | 'export_ready'

const STEP_PROGRESS: Record<ProgressStep, number> = {
    frame_extract: 10,
    detect: 30,
    ocr: 60,
    classify: 80,
    export_ready: 100,
}

const REVIEW_CONFIDENCE_THRESHOLD = 0.6
const ACCOUNT_CONFIDENCE_THRESHOLD = 0.7

async function updateJobProgress(
    jobId: string,
    step: ProgressStep,
    extra?: { detected_receipt_count?: number; needs_review_count?: number; total_amount_sum?: number }
) {
    await prisma.job.update({
        where: { id: jobId },
        data: {
            progress_step: step,
            progress_pct: STEP_PROGRESS[step],
            ...extra,
        },
    })
}

/** 動画処理パイプライン本体 */
export async function processVideoJob(
    jobId: string,
    userId: string,
    storageKey: string
): Promise<void> {
    const tmpDir = path.join(os.tmpdir(), `job-${jobId}`)
    const framesDir = path.join(tmpDir, 'frames')

    try {
        await fs.mkdir(framesDir, { recursive: true })

        // ===== Step 1: ストレージから動画をダウンロード =====
        await updateJobProgress(jobId, 'frame_extract')

        const [bucket, ...pathParts] = storageKey.replace(/^s3:\/\//, '').split('/')
        const storagePath = pathParts.join('/')

        const { data: videoData, error: downloadError } = await supabaseAdmin.storage
            .from(bucket)
            .download(storagePath)

        if (downloadError || !videoData) {
            throw new Error(`動画ダウンロード失敗: ${downloadError?.message}`)
        }

        const videoBuffer = Buffer.from(await videoData.arrayBuffer())
        const videoPath = path.join(tmpDir, 'input.mp4')
        await fs.writeFile(videoPath, videoBuffer)

        // ===== Step 2: FFmpegでフレーム抽出 =====
        const ffmpeg = await import('fluent-ffmpeg')
        const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg')

        await new Promise<void>((resolve, reject) => {
            ffmpeg.default(videoPath)
                .setFfmpegPath(ffmpegInstaller.path)
                .outputOptions(['-vf', 'fps=1,scale=1280:-1', '-q:v', '5'])
                .output(path.join(framesDir, 'frame_%04d.jpg'))
                .on('end', () => resolve())
                .on('error', reject)
                .run()
        })

        const frameFiles = (await fs.readdir(framesDir))
            .filter((f) => f.endsWith('.jpg'))
            .sort()

        // ===== Step 3: 領収書検出 =====
        await updateJobProgress(jobId, 'detect')

        const receiptFrames: string[] = []
        for (const frameFile of frameFiles) {
            const framePath = path.join(framesDir, frameFile)
            const imageBuffer = await fs.readFile(framePath)
            const imageBase64 = imageBuffer.toString('base64')

            const detection = await detectReceipt(imageBase64)
            if (detection.result === 'receipt' && detection.confidence >= REVIEW_CONFIDENCE_THRESHOLD) {
                receiptFrames.push(framePath)
            }
        }

        await updateJobProgress(jobId, 'ocr', { detected_receipt_count: receiptFrames.length })

        // ===== Step 4: OCR + 科目推定 =====
        const user = await prisma.user.findUnique({ where: { id: userId } })
        let needsReviewCount = 0
        let totalAmountSum = 0

        for (let i = 0; i < receiptFrames.length; i++) {
            const framePath = receiptFrames[i]
            const imageBuffer = await fs.readFile(framePath)
            const imageBase64 = imageBuffer.toString('base64')

            // OCR
            const ocrResult = await extractReceiptData(imageBase64)

            // 科目推定：ルールテーブル確認
            let debitAccount = 'その他'
            let debitAccount2: string | null = null
            let accountConfidence = 0.3

            const normalizedStore = ocrResult.store_name?.toLowerCase().trim() ?? ''
            const rule = normalizedStore
                ? await prisma.rule.findFirst({
                    where: { user_id: userId, store_name_key: normalizedStore },
                })
                : null

            if (rule) {
                debitAccount = rule.debit_account
                accountConfidence = 1.0
                await prisma.rule.update({
                    where: { id: rule.id },
                    data: { hit_count: { increment: 1 }, last_used_at: new Date() },
                })
            } else {
                const accountResult = await classifyAccount(
                    ocrResult.store_name,
                    ocrResult.total_amount,
                    ocrResult.tax_info,
                    ocrResult.ocr_raw_text
                )
                debitAccount = accountResult.debit_account
                debitAccount2 = accountResult.debit_account_candidate2
                accountConfidence = accountResult.confidence
            }

            // 要確認理由を計算
            const reviewReasons: string[] = []
            if (!ocrResult.date) reviewReasons.push('date_missing')
            if (!ocrResult.store_name) reviewReasons.push('store_missing')
            if (!ocrResult.total_amount) reviewReasons.push('amount_missing')
            if (ocrResult.confidence < REVIEW_CONFIDENCE_THRESHOLD) reviewReasons.push('low_confidence')
            if (accountConfidence < ACCOUNT_CONFIDENCE_THRESHOLD) reviewReasons.push('debit_account_low_confidence')
            if (ocrResult.invoice_number && !/^T\d{13}$/.test(ocrResult.invoice_number)) {
                reviewReasons.push('invalid_invoice_number')
            }

            const amount = ocrResult.total_amount ?? 0
            totalAmountSum += amount
            if (reviewReasons.length > 0) needsReviewCount++

            // 画像をStorageに保存
            const imagePath = `${userId}/${jobId}/${i + 1}.jpg`
            const { error: uploadError } = await supabaseAdmin.storage
                .from('receipt-images')
                .upload(imagePath, imageBuffer, { contentType: 'image/jpeg', upsert: true })

            if (uploadError) console.warn(`画像アップロード失敗: ${uploadError.message}`)

            const evidenceId = `${jobId}_F${String(i + 1).padStart(4, '0')}`

            await prisma.receipt.create({
                data: {
                    job_id: jobId,
                    user_id: userId,
                    receipt_index: i + 1,
                    evidence_id: evidenceId,
                    image_storage_key: `receipt-images/${imagePath}`,
                    ocr_text_raw: ocrResult.ocr_raw_text,
                    ocr_confidence: ocrResult.confidence,
                    extracted_date: ocrResult.date,
                    extracted_store_name: ocrResult.store_name,
                    extracted_total_amount: ocrResult.total_amount,
                    extracted_invoice_number: ocrResult.invoice_number,
                    extracted_tax_hint: ocrResult.tax_info,
                    final_date: ocrResult.date ?? '1900-01-01',
                    final_store_name: ocrResult.store_name ?? '不明',
                    final_total_amount: amount,
                    invoice_flag: 'unknown',
                    payment_method: 'unknown',
                    debit_account: debitAccount,
                    debit_account_candidate2: debitAccount2,
                    credit_account: user?.default_credit_account ?? '現金',
                    tax_category: '課税10%',
                    partner_name: ocrResult.store_name ?? '不明',
                    description: `${ocrResult.date ?? '日付不明'} ${ocrResult.store_name ?? '店名不明'} ${debitAccount}`,
                    needs_review: reviewReasons.length > 0,
                    review_reasons: reviewReasons,
                    edited_by_user: false,
                },
            })
        }

        // ===== Step 5: ジョブ完了 =====
        await updateJobProgress(jobId, 'classify', {
            detected_receipt_count: receiptFrames.length,
            needs_review_count: needsReviewCount,
            total_amount_sum: totalAmountSum,
        })

        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'completed', progress_pct: 100, progress_step: 'export_ready' },
        })

    } finally {
        // 一時ファイルを削除
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { })
    }
}
