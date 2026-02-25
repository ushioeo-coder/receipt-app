import { NextResponse } from 'next/server'

// 固定の「デフォルトユーザー」オブジェクト
// 認証不要のシングルユーザーモード
const DEFAULT_USER_ID = 'default-user-v1'

/** APIルートでユーザーIDを取得する共通関数（認証不要版） */
export async function getAuthUserId(): Promise<string> {
    // public.users テーブルに存在するか確認し、なければ作成
    const { prisma } = await import('@/lib/prisma')
    await prisma.user.upsert({
        where: { id: DEFAULT_USER_ID },
        update: {},
        create: {
            id: DEFAULT_USER_ID,
            email: 'default@local',
            auth_provider: 'none',
            auth_subject: DEFAULT_USER_ID,
        },
    })
    return DEFAULT_USER_ID
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
