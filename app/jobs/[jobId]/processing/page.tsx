'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface JobStatus {
    status: string
    progress_step: string | null
    progress_pct: number
    detected_receipt_count: number
    needs_review_count: number
    error_code: string | null
}

const STEP_LABELS: Record<string, string> = {
    frame_extract: '動画からフレームを抽出中…',
    detect: '領収書を検出中…',
    ocr: '文字を読み取り中（OCR）…',
    classify: '勘定科目を推定中…',
    export_ready: '処理完了',
}

export default function ProcessingPage() {
    const router = useRouter()
    const params = useParams()
    const jobId = params?.jobId as string

    const [job, setJob] = useState<JobStatus | null>(null)
    const [pollCount, setPollCount] = useState(0)

    const pollJob = useCallback(async () => {
        try {
            const res = await fetch(`/api/jobs/${jobId}`)
            if (!res.ok) return
            const json = await res.json()
            setJob(json.data)

            if (json.data.status === 'completed') {
                router.push(`/jobs/${jobId}/results`)
            } else if (json.data.status === 'failed') {
                // エラー状態はこのページで表示
            }
        } catch {
            // 通信エラーは無視して再試行
        }
        setPollCount((c) => c + 1)
    }, [jobId, router])

    useEffect(() => {
        pollJob()
        const interval = setInterval(pollJob, 3000)
        return () => clearInterval(interval)
    }, [pollJob])

    const handleCancel = async () => {
        if (!confirm('処理をキャンセルしますか？')) return
        await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
        router.push('/upload')
    }

    if (!job) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (job.status === 'failed') {
        return (
            <div className="flex flex-col min-h-screen">
                <header className="bg-white border-b border-gray-200 px-4 py-3 font-bold">
                    📄 レシートスキャン
                </header>
                <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
                    <div className="text-5xl">❌</div>
                    <div>
                        <h2 className="text-xl font-bold text-red-600 mb-2">処理に失敗しました</h2>
                        <p className="text-sm text-gray-500">エラーコード: {job.error_code ?? 'UNKNOWN'}</p>
                    </div>
                    <button onClick={() => router.push('/upload')} className="btn-primary px-8">
                        アップロードし直す
                    </button>
                </main>
            </div>
        )
    }

    const stepLabel = job.progress_step ? (STEP_LABELS[job.progress_step] ?? '処理中…') : '準備中…'

    return (
        <div className="flex flex-col min-h-screen">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="font-bold">📄 レシートスキャン</div>
            </header>

            {/* メイン */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
                {/* アニメーション */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-blue-200 rounded-full" />
                    <div
                        className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
                        style={{ animationDuration: '1.5s' }}
                    />
                    <span className="text-4xl">🔍</span>
                </div>

                <div className="text-center">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">処理中</h2>
                    <p className="text-sm text-blue-600 font-medium">{stepLabel}</p>
                </div>

                {/* プログレスバー */}
                <div className="w-full max-w-xs">
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>進捗</span>
                        <span>{job.progress_pct}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                            style={{ width: `${job.progress_pct}%` }}
                        />
                    </div>
                </div>

                {/* 検出数 */}
                {job.detected_receipt_count > 0 && (
                    <div className="bg-blue-50 rounded-xl px-6 py-3 text-center">
                        <p className="text-xs text-blue-500 font-semibold">現在検出済み</p>
                        <p className="text-3xl font-bold text-blue-600">{job.detected_receipt_count}</p>
                        <p className="text-xs text-blue-500">件の領収書</p>
                    </div>
                )}

                <p className="text-xs text-gray-400 text-center">
                    動画の長さによって数分かかる場合があります。<br />
                    このページを開いたままお待ちください。
                </p>
            </main>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
                <button
                    onClick={handleCancel}
                    className="btn-outline w-full text-sm"
                >
                    キャンセル
                </button>
            </div>
        </div>
    )
}
