import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, ok, err, ApiError } from '@/lib/auth'

type ReviewReason =
    | 'date_missing' | 'amount_missing' | 'store_missing'
    | 'invoice_unknown' | 'low_confidence' | 'debit_account_low_confidence'
    | 'invalid_invoice_number'

/** 要確認フラグの再計算 */
function recalcReviewReasons(data: {
    final_date: string
    final_store_name: string
    final_total_amount: number
    invoice_number: string | null
    invoice_flag: string
    ocr_confidence: number
}): ReviewReason[] {
    const reasons: ReviewReason[] = []
    if (!data.final_date || data.final_date === '1900-01-01') reasons.push('date_missing')
    if (!data.final_store_name || data.final_store_name === '不明') reasons.push('store_missing')
    if (!data.final_total_amount || data.final_total_amount <= 0) reasons.push('amount_missing')
    if (data.invoice_flag === 'unknown') reasons.push('invoice_unknown')
    if (data.ocr_confidence < 0.6) reasons.push('low_confidence')
    if (data.invoice_number && !/^T\d{13}$/.test(data.invoice_number)) {
        reasons.push('invalid_invoice_number')
    }
    return reasons
}

/** GET /api/jobs/:jobId/receipts/:receiptId */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string; receiptId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { receiptId } = await params

        const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } })
        if (!receipt) throw new ApiError('NOT_FOUND', '領収書が見つかりません', 404)
        if (receipt.user_id !== userId) throw new ApiError('FORBIDDEN', 'アクセス権がありません', 403)

        return ok(receipt)
    } catch (e) {
        return err(e)
    }
}

/** PATCH /api/jobs/:jobId/receipts/:receiptId — 編集保存 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string; receiptId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { receiptId } = await params
        const body = await request.json()

        const existing = await prisma.receipt.findUnique({ where: { id: receiptId } })
        if (!existing) throw new ApiError('NOT_FOUND', '領収書が見つかりません', 404)
        if (existing.user_id !== userId) throw new ApiError('FORBIDDEN', 'アクセス権がありません', 403)

        // 要確認フラグを再計算
        const reviewReasons = recalcReviewReasons({
            final_date: body.final_date ?? existing.final_date,
            final_store_name: body.final_store_name ?? existing.final_store_name,
            final_total_amount: body.final_total_amount ?? existing.final_total_amount,
            invoice_number: body.invoice_number ?? existing.invoice_number,
            invoice_flag: body.invoice_flag ?? existing.invoice_flag,
            ocr_confidence: existing.ocr_confidence,
        })

        const updated = await prisma.receipt.update({
            where: { id: receiptId },
            data: {
                ...body,
                needs_review: reviewReasons.length > 0,
                review_reasons: reviewReasons,
                edited_by_user: true,
                updated_at: new Date(),
            },
        })

        // jobの needs_review_count と total_amount_sum を再集計
        const jobReceipts = await prisma.receipt.findMany({
            where: { job_id: existing.job_id },
            select: { needs_review: true, final_total_amount: true },
        })
        await prisma.job.update({
            where: { id: existing.job_id },
            data: {
                needs_review_count: jobReceipts.filter((r: { needs_review: boolean }) => r.needs_review).length,
                total_amount_sum: jobReceipts.reduce((s: number, r: { final_total_amount: number }) => s + r.final_total_amount, 0),
            },
        })

        return ok({
            id: updated.id,
            needs_review: updated.needs_review,
            review_reasons: updated.review_reasons,
        })
    } catch (e) {
        return err(e)
    }
}

/** DELETE /api/jobs/:jobId/receipts/:receiptId */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string; receiptId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { receiptId } = await params

        const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } })
        if (!receipt) throw new ApiError('NOT_FOUND', '領収書が見つかりません', 404)
        if (receipt.user_id !== userId) throw new ApiError('FORBIDDEN', 'アクセス権がありません', 403)

        await prisma.receipt.delete({ where: { id: receiptId } })

        return new Response(null, { status: 204 })
    } catch (e) {
        return err(e)
    }
}
