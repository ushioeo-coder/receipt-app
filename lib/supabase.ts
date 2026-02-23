import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

// サーバーサイド専用（Service Role Key）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// クライアントサイド / 公開操作用（Anon Key）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===== ストレージ操作ヘルパー =====

/** 署名付きURLを生成（ダウンロード用）*/
export async function createSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds = 3600
): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds)

    if (error || !data?.signedUrl) {
        throw new Error(`署名付きURL生成失敗: ${error?.message}`)
    }
    return data.signedUrl
}

/** ファイルをアップロードしてストレージキーを返す */
export async function uploadFile(
    bucket: string,
    path: string,
    file: Buffer | Uint8Array,
    contentType: string
): Promise<string> {
    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(path, file, { contentType, upsert: true })

    if (error) throw new Error(`アップロード失敗: ${error.message}`)
    return `${bucket}/${path}`
}

/** ファイルを削除 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([path])
    if (error) throw new Error(`削除失敗: ${error.message}`)
}
