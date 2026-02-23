import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, ok, err, ApiError } from '@/lib/auth'

type SortOrder = 'date_desc' | 'amount_desc' | 'needs_review_first'

/** GET /api/jobs/:jobId/receipts — 領収書一覧 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { jobId } = await params
        const { searchParams } = new URL(request.url)

        // クエリパラメータ
        const needsReview = searchParams.get('needs_review')
        const invoiceFlag = searchParams.get('invoice_flag')
        const debitAccount = searchParams.get('debit_account')
        const sort = (searchParams.get('sort') ?? 'date_desc') as SortOrder

        // 権限確認
        const job = await prisma.job.findUnique({ where: { id: jobId } })
        if (!job) throw new ApiError('NOT_FOUND', 'ジョブが見つかりません', 404)
        if (job.user_id !== userId) throw new ApiError('FORBIDDEN', 'アクセス権がありません', 403)

        const where: Record<string, unknown> = {
            job_id: jobId,
            user_id: userId,
            ...(needsReview !== null ? { needs_review: needsReview === 'true' } : {}),
            ...(invoiceFlag ? { invoice_flag: invoiceFlag } : {}),
            ...(debitAccount ? { debit_account: debitAccount } : {}),
        }

        const orderBy =
            sort === 'amount_desc'
                ? { final_total_amount: 'desc' as const }
                : sort === 'needs_review_first'
                    ? [{ needs_review: 'desc' as const }, { receipt_index: 'asc' as const }]
                    : { final_date: 'desc' as const }

        const receipts = await prisma.receipt.findMany({
            where,
            orderBy,
            select: {
                id: true,
                receipt_index: true,
                evidence_id: true,
                thumbnail_storage_key: true,
                final_date: true,
                final_store_name: true,
                final_total_amount: true,
                debit_account: true,
                needs_review: true,
                review_reasons: true,
            },
        })

        const summary = {
            total: receipts.length,
            needs_review_count: receipts.filter((r: { needs_review: boolean }) => r.needs_review).length,
            total_amount_sum: receipts.reduce((s: number, r: { final_total_amount: number }) => s + r.final_total_amount, 0),
        }

        return ok({ receipts, summary })
    } catch (e) {
        return err(e)
    }
}
