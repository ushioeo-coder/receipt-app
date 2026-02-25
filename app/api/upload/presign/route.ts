import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ok, err } from '@/lib/auth'

/** POST /api/upload/presign — 動画アップロード用署名付きURL発行（認証不要） */
export async function POST(request: NextRequest) {
    try {
        const { filename, mime } = await request.json()
        if (!filename) {
            return err(new Error('filenameは必須です'))
        }

        const timestamp = Date.now()
        const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        const storagePath = `uploads/${timestamp}/${safeName}`

        const { data, error } = await supabaseAdmin.storage
            .from('videos')
            .createSignedUploadUrl(storagePath)

        if (error || !data) {
            console.error('Presign error:', error)
            throw new Error(`署名付きURL発行失敗: ${error?.message}`)
        }

        return ok({ upload_url: data.signedUrl, storage_key: storagePath })
    } catch (e) {
        return err(e)
    }
}
