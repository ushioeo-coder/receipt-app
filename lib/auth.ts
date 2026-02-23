import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/** Supabase Authセッションからユーザーを取得するサーバークライアント */
export async function createSupabaseServerClient() {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                },
            },
        }
    )
}

/** APIルートでユーザーIDを取得する共通関数 */
export async function getAuthUserId(): Promise<string> {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        throw new ApiError('UNAUTHORIZED', '認証が必要です', 401)
    }

    return user.id
}

/** リクエストからユーザーIDを取得（後方互換のため維持） */
export function getUserIdFromRequest(_request: unknown): string {
    // Supabase Auth方式に移行のため、この関数はAPIルート内でgetAuthUserId()を使う
    throw new ApiError('UNAUTHORIZED', 'getUserIdFromRequest is deprecated. Use getAuthUserId()', 500)
}

/** APIエラークラス */
export class ApiError extends Error {
    constructor(
        public code: string,
        message: string,
        public status: number = 400
    ) {
        super(message)
    }
}

/** 成功レスポンス */
export function ok(data: unknown, status = 200) {
    return NextResponse.json({ data }, { status })
}

/** エラーレスポンス */
export function err(e: unknown) {
    if (e instanceof ApiError) {
        return NextResponse.json(
            { error: { code: e.code, message: e.message } },
            { status: e.status }
        )
    }
    console.error('[API Error]', e)
    return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } },
        { status: 500 }
    )
}
