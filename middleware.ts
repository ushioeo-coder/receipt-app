import { NextResponse, type NextRequest } from 'next/server'

// 認証チェックなし - アクセスしたら即使用可能
export function middleware(_request: NextRequest) {
    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
