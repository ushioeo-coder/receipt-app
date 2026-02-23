'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface ReceiptItem {
    id: string
    receipt_index: number
    evidence_id: string
    thumbnail_storage_key: string | null
    final_date: string
    final_store_name: string
    final_total_amount: number
    debit_account: string
    needs_review: boolean
    review_reasons: string[]
}

interface Summary {
    total: number
    needs_review_count: number
    total_amount_sum: number
}

const SORT_LABELS: Record<string, string> = {
    needs_review_first: '要確認を先頭に',
    date_desc: '日付（新しい順）',
    amount_desc: '金額（大きい順）',
}

export default function ResultsPage() {
    const router = useRouter()
    const params = useParams()
    const jobId = params?.jobId as string

    const [receipts, setReceipts] = useState<ReceiptItem[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [sort, setSort] = useState('needs_review_first')
    const [filterReview, setFilterReview] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(true)
    const [showFilterModal, setShowFilterModal] = useState(false)

    const fetchReceipts = async () => {
        const params = new URLSearchParams({ sort })
        if (filterReview !== null) params.set('needs_review', String(filterReview))

        const res = await fetch(`/api/jobs/${jobId}/receipts?${params}`)
        if (!res.ok) return
        const json = await res.json()
        setReceipts(json.data.receipts)
        setSummary(json.data.summary)
        setLoading(false)
    }

    useEffect(() => { fetchReceipts() }, [jobId, sort, filterReview])

    if (loading) {
        return <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="font-bold">📄 レシートスキャン</div>
                <button
                    onClick={() => setShowFilterModal(true)}
                    className="text-xs border border-gray-300 rounded-full px-3 py-1.5 text-gray-600"
                >
                    ⚙ 並替・絞込
                </button>
            </header>

            {/* サマリバー */}
            {summary && (
                <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 grid grid-cols-3 text-center">
                    <div>
                        <p className="text-xl font-bold text-blue-600">{summary.total}</p>
                        <p className="text-xs text-blue-400">合計件数</p>
                    </div>
                    <div>
                        <p className="text-xl font-bold text-amber-600">{summary.needs_review_count}</p>
                        <p className="text-xs text-amber-400">要確認</p>
                    </div>
                    <div>
                        <p className="text-xl font-bold text-gray-700">¥{summary.total_amount_sum.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">合計金額</p>
                    </div>
                </div>
            )}

            {/* 要確認バナー */}
            {summary && summary.needs_review_count > 0 && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="badge-warn">⚠ 要確認</span>
                        <span className="text-sm text-amber-700">{summary.needs_review_count}件の確認が必要です</span>
                    </div>
                    <button
                        onClick={() => setFilterReview(true)}
                        className="text-xs text-amber-600 underline"
                    >表示</button>
                </div>
            )}

            {/* リスト */}
            <main className="flex-1 px-4 py-4">
                {receipts.length === 0 ? (
                    <div className="text-center text-gray-400 py-16 text-sm">
                        領収書が見つかりませんでした
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {receipts.map((r) => (
                            <li key={r.id}>
                                <Link href={`/jobs/${jobId}/receipts/${r.id}`} className="block card hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                                            🧾
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{r.final_store_name}</p>
                                                {r.needs_review && <span className="badge-warn flex-shrink-0">要確認</span>}
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xs text-gray-500">{r.final_date} · {r.debit_account}</span>
                                                <span className="text-sm font-bold text-gray-800">
                                                    ¥{r.final_total_amount.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </main>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 flex gap-3">
                <button
                    onClick={() => router.push(`/jobs/${jobId}/export`)}
                    className="btn-primary flex-1 text-sm"
                >Excel出力 →</button>
            </div>

            {/* フィルタモーダル */}
            {showFilterModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div className="bg-white w-full max-w-[430px] mx-auto rounded-t-2xl p-6 pb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg">並替・絞込</h2>
                            <button onClick={() => setShowFilterModal(false)} className="text-gray-400 text-xl">✕</button>
                        </div>

                        <div className="mb-4">
                            <p className="text-xs font-bold text-gray-500 mb-2">並び替え</p>
                            {Object.entries(SORT_LABELS).map(([value, label]) => (
                                <button
                                    key={value}
                                    onClick={() => { setSort(value); setShowFilterModal(false) }}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm mb-1 transition-colors ${sort === value ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >{label}</button>
                            ))}
                        </div>

                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-2">絞り込み</p>
                            {[
                                { value: null, label: 'すべて表示' },
                                { value: true, label: '⚠ 要確認のみ' },
                                { value: false, label: '✅ 確認済みのみ' },
                            ].map(({ value, label }) => (
                                <button
                                    key={String(value)}
                                    onClick={() => { setFilterReview(value); setShowFilterModal(false) }}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm mb-1 transition-colors ${filterReview === value ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >{label}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
