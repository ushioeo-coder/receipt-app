import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, ok, err, ApiError } from '@/lib/auth'
import { uploadFile } from '@/lib/supabase'
import { processVideoJob } from '@/lib/pipeline'

/** GET /api/jobs — ジョブ一覧 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthUserId()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
        const offset = parseInt(searchParams.get('offset') ?? '0')

        const where = { user_id: userId, ...(status ? { status } : {}) }

        const [jobs, total] = await Promise.all([
            prisma.job.findMany({
                where,
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.job.count({ where }),
        ])

        return ok({ jobs, total })
    } catch (e) {
        return err(e)
    }
}

/** POST /api/jobs — ジョブ作成（動画はクライアントがSupabase Storageに直接アップロード済み） */
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUserId()
        const { storage_key, filename, size, mime } = await request.json()

        if (!storage_key || !filename) {
            throw new ApiError('MISSING_PARAMS', 'storage_keyとfilenameは必須です', 400)
        }

        // ジョブ作成（ファイルはすでにStorageにある）
        const job = await prisma.job.create({
            data: {
                user_id: userId,
                status: 'processing',
                progress_pct: 0,
                video_filename: filename,
                video_mime: mime ?? 'video/mp4',
                video_size_bytes: BigInt(size ?? 0),
                video_storage_key: storage_key,
                detected_receipt_count: 0,
                needs_review_count: 0,
                total_amount_sum: 0,
            },
        })

        // バックグラウンドでパイプライン実行（fire-and-forget）
        processVideoJob(job.id, userId, storage_key).catch((e) => {
            console.error(`Job ${job.id} failed:`, e)
            prisma.job.update({
                where: { id: job.id },
                data: { status: 'failed', error_code: 'PIPELINE_ERROR', error_message: String(e) },
            })
        })

        return ok({ job_id: job.id, status: 'processing' }, 201)
    } catch (e) {
        return err(e)
    }
}
