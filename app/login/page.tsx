'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [signupDone, setSignupDone] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (mode === 'signup') {
            const { error } = await supabase.auth.signUp({ email, password })
            if (error) {
                setError(error.message)
            } else {
                setSignupDone(true)
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) {
                setError('メールアドレスまたはパスワードが間違っています')
            } else {
                router.push('/upload')
                router.refresh()
            }
        }
        setLoading(false)
    }

    if (signupDone) {
        return (
            <div className="flex flex-col min-h-screen items-center justify-center px-8 gap-6 text-center">
                <div className="text-5xl">📧</div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">確認メールを送信しました</h2>
                    <p className="text-sm text-gray-500">
                        {email} に確認メールを送りました。<br />
                        メール内のリンクをクリックして登録を完了してください。
                    </p>
                </div>
                <button onClick={() => { setMode('login'); setSignupDone(false) }} className="btn-outline px-8 text-sm">
                    ログインに戻る
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="font-bold text-base">📄 レシートスキャン</div>
            </header>

            {/* メインコンテンツ */}
            <main className="flex-1 flex flex-col items-center justify-center px-8 py-12 gap-8">
                <div className="text-center">
                    <div className="text-5xl mb-4">📄</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">レシートスキャン</h1>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        動画で領収書を撮影するだけで<br />
                        弥生会計向けExcelを自動生成
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 text-center">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>メールアドレス</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@email.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>パスワード</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={mode === 'signup' ? '8文字以上' : 'パスワード'}
                            minLength={mode === 'signup' ? 8 : undefined}
                            required
                        />
                    </div>

                    <button type="submit" disabled={loading} className="btn-primary w-full text-base mt-2">
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                {mode === 'login' ? 'ログイン中…' : '登録中…'}
                            </span>
                        ) : mode === 'login' ? 'ログイン' : 'アカウント作成'}
                    </button>

                    <p className="text-center text-sm text-gray-400">
                        {mode === 'login' ? (
                            <>アカウントをお持ちでない方は{' '}
                                <button type="button" onClick={() => setMode('signup')} className="text-blue-500 underline">新規登録</button>
                            </>
                        ) : (
                            <>既にアカウントをお持ちの方は{' '}
                                <button type="button" onClick={() => setMode('login')} className="text-blue-500 underline">ログイン</button>
                            </>
                        )}
                    </p>
                </form>
            </main>
        </div>
    )
}
