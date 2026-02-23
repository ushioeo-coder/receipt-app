'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface JobSummary {
    detected_receipt_count: number
    needs_review_count: number
    total_amount_sum: number
}

const CREDIT_ACCOUNTS = ['現金', '普通預金', '当座預金', 'クレジットカード', '未払金']

export default function ExportPage() {
    const params = useParams()
    const router = useRouter()
    const jobId = params?.jobId as string

    const [summary, setSummary] = useState<JobSummary | null>(null)
    const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
    const [creditAccount, setCreditAccount] = useState('現金')
    const [exporting, setExporting] = useState(false)
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
    const [rowCount, setRowCount] = useState(0)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch(`/api/jobs/${jobId}`)
            .then((r) => r.json())
            .then((json) => setSummary(json.data))
    }, [jobId])

    const handleExport = async () => {
        setExporting(true)
        setError(null)
        setDownloadUrl(null)

        try {
            const res = await fetch(`/api/jobs/${jobId}/exports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ format, credit_account_default: creditAccount }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.message ?? '出力失敗')

            setDownloadUrl(json.data.download_url)
            setRowCount(json.data.row_count)

            // 自動ダウンロード開始
            const link = document.createElement('a')
            link.href = json.data.download_url
            link.download = `receipts_${new Date().toISOString().split('T')[0]}.${format}`
            link.click()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'エラーが発生しました')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={() => router.back()} className="text-gray-500 text-xl">←</button>
                <div className="font-bold">Excel出力</div>
            </header>

            <main className="flex-1 px-4 py-6 flex flex-col gap-6">
                {/* サマリ */}
                {summary && (
                    <div className="card">
                        <p className="text-xs font-bold text-gray-400 mb-3">処理結果</p>
                        <div className="grid grid-cols-3 text-center gap-4">
                            <div>
                                <p className="text-2xl font-bold text-blue-600">{summary.detected_receipt_count}</p>
                                <p className="text-xs text-gray-400">総件数</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-amber-500">{summary.needs_review_count}</p>
                                <p className="text-xs text-gray-400">要確認</p>
                            </div>
                            <div>
                                <p className="text-xl font-bold text-gray-700">¥{(summary.total_amount_sum ?? 0).toLocaleString()}</p>
                                <p className="text-xs text-gray-400">合計</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 要確認がある場合の警告 */}
                {summary && summary.needs_review_count > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <p className="text-sm font-bold text-amber-700">{summary.needs_review_count}件の要確認があります</p>
                            <p className="text-xs text-amber-600 mt-0.5">そのままでも出力できますが、内容を確認することをおすすめします。</p>
                            <button
                                onClick={() => router.push(`/jobs/${jobId}/results?needs_review=true`)}
                                className="text-xs text-amber-600 underline mt-1"
                            >確認する →</button>
                        </div>
                    </div>
                )}

                {/* 出力設定 */}
                <section>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">出力設定</p>
                    <div className="flex flex-col gap-4">
                        <div>
                            <p className="text-xs font-semibold text-gray-600 mb-2">ファイル形式</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['xlsx', 'csv'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFormat(f)}
                                        className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${format === f
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-200 text-gray-500'
                                            }`}
                                    >
                                        {f === 'xlsx' ? '📊 Excel (.xlsx)' : '📄 CSV (.csv)'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>貸方科目（デフォルト）</label>
                            <select value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)}>
                                {CREDIT_ACCOUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                {/* 出力内容説明 */}
                {format === 'xlsx' && (
                    <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
                        <p className="font-semibold text-gray-600 mb-1.5">含まれるシート</p>
                        <ul className="space-y-1">
                            <li>・<strong>仕訳データ</strong>：弥生会計向け全項目</li>
                            <li>・<strong>要確認リスト</strong>：確認が必要な領収書のみ抜粋</li>
                            <li>・<strong>サマリ</strong>：科目別集計</li>
                        </ul>
                    </div>
                )}

                {/* エラー */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                        ⚠️ {error}
                    </div>
                )}

                {/* 成功 */}
                {downloadUrl && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">✅</span>
                            <div>
                                <p className="text-sm font-bold text-green-700">出力完了！</p>
                                <p className="text-xs text-green-600">{rowCount}件 · ダウンロードが開始されました</p>
                            </div>
                        </div>
                        <a
                            href={downloadUrl}
                            className="text-center text-sm text-blue-600 underline"
                        >再ダウンロード（1時間有効）</a>
                    </div>
                )}
            </main>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 flex gap-3">
                {downloadUrl ? (
                    <button
                        onClick={() => router.push('/upload')}
                        className="btn-primary w-full text-sm"
                    >新しい動画を処理する</button>
                ) : (
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="btn-primary w-full text-base"
                    >
                        {exporting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                出力中…
                            </span>
                        ) : `${format.toUpperCase()}をダウンロード`}
                    </button>
                )}
            </div>
        </div>
    )
}
