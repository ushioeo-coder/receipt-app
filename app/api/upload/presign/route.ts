import { NextRequest } from 'next/server'
import { getAuthUserId, ok, err, ApiError } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/upload/presign
 * クライアントが直接Supabase StorageにアップロードするためのPresigned URLを発行
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUserId()
        const body = await request.json()
        const { filename, size, mime } = body

        if (!filename || !size || !mime) {
            throw new ApiError('MISSING_PARAMS', 'filename, size, mimeは必須です', 400)
        }

        // バリデーション
        const MAX_SIZE = 200 * 1024 * 1024 // 200MB
        const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo']

        if (size > MAX_SIZE) {
            throw new ApiError('VIDEO_TOO_LARGE', 'ファイルサイズは200MB以下にしてください', 400)
        }
        if (!ALLOWED_TYPES.includes(mime)) {
            throw new ApiError('UNSUPPORTED_FORMAT', 'MP4, MOV, AVI形式の動画をアップロードしてください', 400)
        }

        // ストレージパスを生成
        const timestamp = Date.now()
        const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        const storagePath = `${userId}/${timestamp}/${safeName}`

        // Presigned URLを発行（有効期間60秒）
        const { data, error } = await supabaseAdmin.storage
            .from('videos')
            .createSignedUploadUrl(storagePath)

        if (error || !data) {
            throw new ApiError('PRESIGN_FAILED', `署名付きURL発行失敗: ${error?.message}`, 500)
        }

        return ok({
            upload_url: data.signedUrl,
            storage_key: storagePath,
            token: data.token,
        })
    } catch (e) {
        return err(e)
    }
}
