import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// パブリックパス（認証不要）
const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // パブリックパスはスキップ
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next()
    }

    let supabaseResponse = NextResponse.next({ request })

    try {
        const supabase = createServerClient(
            (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
            (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
            {
                cookies: {
                    getAll() { return request.cookies.getAll() },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) =>
                            request.cookies.set(name, value)
                        )
                        supabaseResponse = NextResponse.next({ request })
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        return supabaseResponse
    } catch (err) {
        // エラー時は安全のためログインへ
        console.error('Middleware error:', err)
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/auth).*)'],
}
