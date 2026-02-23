import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, ok, err, ApiError } from '@/lib/auth'

/** GET /api/jobs/:jobId — ジョブ詳細（ポーリング用） */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { jobId } = await params

        const job = await prisma.job.findUnique({ where: { id: jobId } })
        if (!job) throw new ApiError('NOT_FOUND', 'ジョブが見つかりません', 404)
        if (job.user_id !== userId) throw new ApiError('FORBIDDEN', 'アクセス権がありません', 403)

        return ok({
            id: job.id,
            status: job.status,
            progress_step: job.progress_step,
            progress_pct: job.progress_pct,
            detected_receipt_count: job.detected_receipt_count,
            needs_review_count: job.needs_review_count,
            total_amount_sum: job.total_amount_sum,
            error_code: job.error_code,
        })
    } catch (e) {
        return err(e)
    }
}

/** DELETE /api/jobs/:jobId — ジョブキャンセル */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const userId = await getAuthUserId()
        const { jobId } = await params

        const job = await prisma.job.findUnique({ where: { id: jobId } })
        if (!job) throw new ApiError('NOT_FOUND', 'ジョブが見つかりません', 404)
        if (job.user_id !== userId) throw new ApiError('FORBIDDEN', 'アクセス権がありません', 403)

        if (!['queued', 'processing'].includes(job.status)) {
            throw new ApiError('JOB_NOT_CANCELABLE', 'このジョブはキャンセルできません', 409)
        }

        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'canceled' },
        })

        return ok({ status: 'canceled' })
    } catch (e) {
        return err(e)
    }
}
