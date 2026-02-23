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

/** POST /api/jobs — 動画アップロード & ジョブ作成 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUserId()
        const formData = await request.formData()
        const file = formData.get('video') as File | null

        if (!file) {
            throw new ApiError('MISSING_FILE', '動画ファイルが必要です', 400)
        }

        // バリデーション
        const MAX_SIZE = 200 * 1024 * 1024 // 200MB
        const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo']

        if (file.size > MAX_SIZE) {
            throw new ApiError('VIDEO_TOO_LARGE', 'ファイルサイズは200MB以下にしてください', 400)
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new ApiError('UNSUPPORTED_FORMAT', 'MP4, MOV, AVI形式の動画をアップロードしてください', 400)
        }

        // ジョブ作成
        const job = await prisma.job.create({
            data: {
                user_id: userId,
                status: 'queued',
                progress_pct: 0,
                video_filename: file.name,
                video_mime: file.type,
                video_size_bytes: BigInt(file.size),
                video_storage_key: '',
                detected_receipt_count: 0,
                needs_review_count: 0,
                total_amount_sum: 0,
            },
        })

        // 動画をSupabase StorageにアップロードA
        const buffer = Buffer.from(await file.arrayBuffer())
        const storagePath = `${userId}/${job.id}/${file.name}`
        const storageKey = await uploadFile('videos', storagePath, buffer, file.type)

        await prisma.job.update({
            where: { id: job.id },
            data: { video_storage_key: storageKey, status: 'processing' },
        })

        // バックグラウンドでパイプライン実行（fire-and-forget）
        processVideoJob(job.id, userId, storageKey).catch((e) => {
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
