import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, ok, err, ApiError } from '@/lib/auth'
import { generateExcel, generateCsv } from '@/lib/excel'
import { uploadFile, createSignedUrl } from '@/lib/supabase'

/** POST /api/jobs/:jobId/exports — Excel/CSV生成 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { jobId } = await params
        const body = await request.json()
        const format: 'xlsx' | 'csv' = body.format ?? 'xlsx'
        const creditAccountDefault: string = body.credit_account_default ?? '現金'

        // 権限確認
        const job = await prisma.job.findUnique({ where: { id: jobId } })
        if (!job) throw new ApiError('NOT_FOUND', 'ジョブが見つかりません', 404)
        if (job.user_id !== userId) throw new ApiError('FORBIDDEN', 'アクセス権がありません', 403)

        // 領収書データ取得
        const receipts = await prisma.receipt.findMany({
            where: { job_id: jobId, user_id: userId },
            orderBy: { receipt_index: 'asc' },
        })

        // ファイル生成
        let fileBuffer: Buffer
        let mimeType: string
        let ext: string

        if (format === 'xlsx') {
            fileBuffer = await generateExcel(receipts.map((r: typeof receipts[0]) => ({
                ...r,
                review_reasons: (r.review_reasons as string[]) ?? [],
            })))
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ext = 'xlsx'
        } else {
            const csv = await generateCsv(receipts.map((r: typeof receipts[0]) => ({
                ...r,
                review_reasons: (r.review_reasons as string[]) ?? [],
            })))
            fileBuffer = Buffer.from(csv, 'utf-8')
            mimeType = 'text/csv'
            ext = 'csv'
        }

        // Supabase Storageにアップロード
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const storagePath = `${userId}/${jobId}/${timestamp}.${ext}`
        const storageKey = await uploadFile('exports', storagePath, fileBuffer, mimeType)

        // exportレコード作成
        const exportRecord = await prisma.export.create({
            data: {
                job_id: jobId,
                user_id: userId,
                format,
                template_version: 'yayo-01',
                credit_account_default: creditAccountDefault,
                file_storage_key: storageKey,
                row_count: receipts.length,
            },
        })

        // 署名付きURLを生成（1時間有効）
        const downloadUrl = await createSignedUrl('exports', storagePath, 3600)

        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()

        return ok({
            export_id: exportRecord.id,
            download_url: downloadUrl,
            row_count: receipts.length,
            expires_at: expiresAt,
        }, 201)
    } catch (e) {
        return err(e)
    }
}

/** GET /api/jobs/:jobId/exports — 出力履歴 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { jobId } = await params

        const exports = await prisma.export.findMany({
            where: { job_id: jobId, user_id: userId },
            orderBy: { created_at: 'desc' },
        })

        return ok({ exports })
    } catch (e) {
        return err(e)
    }
}
