'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Receipt {
    id: string
    evidence_id: string
    final_date: string
    final_store_name: string
    final_total_amount: number
    debit_account: string
    debit_account_candidate2: string | null
    credit_account: string
    tax_category: string
    partner_name: string
    description: string
    payment_method: string
    invoice_flag: string
    invoice_number: string | null
    memo: string | null
    needs_review: boolean
    review_reasons: string[]
    ocr_confidence: number
    ocr_text_raw: string | null
}

const DEBIT_ACCOUNTS = [
    '消耗品費', '交際費', '会議費', '旅費交通費', '通信費',
    '車両費', '水道光熱費', '地代家賃', '広告宣伝費',
    '新聞図書費', '事務用品費', '修繕費', '外注費', 'その他',
]

const TAX_CATEGORIES = ['課税10%', '課税8%（軽減）', '非課税', '不課税', '免税']

const PAYMENT_METHODS = ['cash', 'card', 'transit', 'transfer', 'unknown'] as const
const PAYMENT_LABELS: Record<string, string> = {
    cash: '現金', card: 'クレジットカード', transit: '電子マネー',
    transfer: '銀行振込', unknown: '不明',
}

const REVIEW_REASON_LABELS: Record<string, string> = {
    date_missing: '日付不明', amount_missing: '金額不明', store_missing: '店名不明',
    invoice_unknown: 'インボイス不明', low_confidence: '読み取り精度が低い',
    debit_account_low_confidence: '科目推定の精度が低い',
    invalid_invoice_number: '登録番号の形式が不正',
}

export default function ReceiptDetailPage() {
    const router = useRouter()
    const params = useParams()
    const jobId = params?.jobId as string
    const receiptId = params?.receiptId as string

    const [receipt, setReceipt] = useState<Receipt | null>(null)
    const [form, setForm] = useState<Partial<Receipt>>({})
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [showOcr, setShowOcr] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showRuleSave, setShowRuleSave] = useState(false)

    useEffect(() => {
        fetch(`/api/jobs/${jobId}/receipts/${receiptId}`)
            .then((r) => r.json())
            .then((json) => {
                setReceipt(json.data)
                setForm(json.data)
            })
    }, [jobId, receiptId])

    const handleSave = async () => {
        setSaving(true)
        const res = await fetch(`/api/jobs/${jobId}/receipts/${receiptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const json = await res.json()
        if (res.ok) {
            setReceipt((prev) => prev ? { ...prev, ...json.data } : prev)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)

            // 科目変更があればルール学習を提案
            if (form.debit_account !== receipt?.debit_account) {
                setShowRuleSave(true)
            }
        }
        setSaving(false)
    }

    const handleDelete = async () => {
        await fetch(`/api/jobs/${jobId}/receipts/${receiptId}`, { method: 'DELETE' })
        router.back()
    }

    const handleSaveRule = async () => {
        await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                store_name_key: form.final_store_name,
                debit_account: form.debit_account,
                tax_category: form.tax_category,
            }),
        })
        setShowRuleSave(false)
    }

    if (!receipt) {
        return <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={() => router.back()} className="text-gray-500 text-xl">←</button>
                <div className="flex-1">
                    <p className="font-bold text-sm">{form.final_store_name || '店名不明'}</p>
                    <p className="text-xs text-gray-400">{form.final_date}</p>
                </div>
                {receipt.needs_review && <span className="badge-warn">要確認</span>}
                {!receipt.needs_review && <span className="badge-ok">✅ 確認済</span>}
            </header>

            {/* 要確認理由 */}
            {receipt.needs_review && receipt.review_reasons.length > 0 && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">⚠ 確認が必要な項目</p>
                    <ul className="text-xs text-amber-600 space-y-0.5">
                        {(receipt.review_reasons as string[]).map((reason) => (
                            <li key={reason}>・{REVIEW_REASON_LABELS[reason] ?? reason}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* フォーム */}
            <main className="flex-1 px-4 py-5 flex flex-col gap-4 overflow-y-auto">
                {/* === 基本情報 === */}
                <section>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">基本情報</p>
                    <div className="flex flex-col gap-3">
                        <div className="form-group">
                            <label>取引日 *</label>
                            <input type="date" value={form.final_date ?? ''} onChange={(e) => setForm({ ...form, final_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>店名・取引先 *</label>
                            <input type="text" value={form.final_store_name ?? ''} onChange={(e) => setForm({ ...form, final_store_name: e.target.value, partner_name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>金額（円） *</label>
                            <input type="number" value={form.final_total_amount ?? ''} onChange={(e) => setForm({ ...form, final_total_amount: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                </section>

                {/* === 科目・税区分 === */}
                <section>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">勘定科目</p>
                    <div className="flex flex-col gap-3">
                        <div className="form-group">
                            <label>借方科目 *</label>
                            <select value={form.debit_account ?? ''} onChange={(e) => setForm({ ...form, debit_account: e.target.value })}>
                                {DEBIT_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        {form.debit_account_candidate2 && (
                            <p className="text-xs text-blue-500">候補2: {form.debit_account_candidate2}</p>
                        )}
                        <div className="form-group">
                            <label>貸方科目</label>
                            <input type="text" value={form.credit_account ?? ''} onChange={(e) => setForm({ ...form, credit_account: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>税区分</label>
                            <select value={form.tax_category ?? ''} onChange={(e) => setForm({ ...form, tax_category: e.target.value })}>
                                {TAX_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                {/* === 支払・インボイス === */}
                <section>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">支払・インボイス</p>
                    <div className="flex flex-col gap-3">
                        <div className="form-group">
                            <label>支払方法</label>
                            <select value={form.payment_method ?? 'unknown'} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                                {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>インボイス</label>
                            <select value={form.invoice_flag ?? 'unknown'} onChange={(e) => setForm({ ...form, invoice_flag: e.target.value })}>
                                <option value="yes">適格（インボイスあり）</option>
                                <option value="no">非適格</option>
                                <option value="unknown">不明</option>
                            </select>
                        </div>
                        {form.invoice_flag === 'yes' && (
                            <div className="form-group">
                                <label>登録番号（T+13桁）</label>
                                <input type="text" placeholder="T1234567890123" value={form.invoice_number ?? ''} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
                            </div>
                        )}
                    </div>
                </section>

                {/* === 摘要 === */}
                <section>
                    <div className="form-group">
                        <label>摘要</label>
                        <textarea rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="form-group mt-3">
                        <label>メモ</label>
                        <textarea rows={2} value={form.memo ?? ''} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
                    </div>
                </section>

                {/* === OCR生テキスト === */}
                {receipt.ocr_text_raw && (
                    <section>
                        <button onClick={() => setShowOcr(!showOcr)} className="text-xs text-blue-500 underline">
                            {showOcr ? '▲ OCR生データを閉じる' : '▼ OCR生データを確認'}
                        </button>
                        {showOcr && (
                            <pre className="mt-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 whitespace-pre-wrap">{receipt.ocr_text_raw}</pre>
                        )}
                    </section>
                )}

                {/* 削除ボタン */}
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-400 text-xs underline self-start"
                >この領収書を削除する</button>
            </main>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 flex gap-3">
                <button onClick={() => router.back()} className="btn-outline flex-1 text-sm">戻る</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 text-sm">
                    {saving ? '保存中…' : saved ? '✅ 保存済み' : '保存する'}
                </button>
            </div>

            {/* 削除確認モーダル */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div className="bg-white w-full max-w-[430px] mx-auto rounded-t-2xl p-6 pb-8">
                        <h2 className="font-bold text-lg mb-2">削除の確認</h2>
                        <p className="text-sm text-gray-500 mb-6">この領収書データを削除しますか？この操作は取り消せません。</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn-outline flex-1">キャンセル</button>
                            <button onClick={handleDelete} className="btn-danger flex-1">削除する</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ルール学習モーダル */}
            {showRuleSave && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div className="bg-white w-full max-w-[430px] mx-auto rounded-t-2xl p-6 pb-8">
                        <h2 className="font-bold text-lg mb-2">💡 学習ルールを保存</h2>
                        <p className="text-sm text-gray-500 mb-2">
                            「{form.final_store_name}」→「{form.debit_account}」を記憶しますか？
                        </p>
                        <p className="text-xs text-gray-400 mb-6">次回同じ店の領収書を処理する際に自動で科目が設定されます。</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowRuleSave(false)} className="btn-outline flex-1 text-sm">今回だけ</button>
                            <button onClick={handleSaveRule} className="btn-primary flex-1 text-sm">記憶する</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
