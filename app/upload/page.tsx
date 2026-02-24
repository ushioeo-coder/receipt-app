'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
const MAX_SIZE_MB = 200

export default function UploadPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [showGuide, setShowGuide] = useState(false)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const validateFile = (file: File): string | null => {
        if (!ALLOWED_TYPES.includes(file.type)) return '対応形式: MP4, MOV, AVI'
        if (file.size > MAX_SIZE_MB * 1024 * 1024) return `ファイルサイズは${MAX_SIZE_MB}MB以下にしてください`
        return null
    }

    const handleFile = (file: File) => {
        const err = validateFile(file)
        if (err) { setError(err); return }
        setError(null)
        setSelectedFile(file)
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }, [])

    const handleUpload = async () => {
        if (!selectedFile) return
        setUploading(true)
        setError(null)
        setUploadProgress(5)

        try {
            // 1. ログイン中ユーザーを取得
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) throw new Error('ログインが必要です')

            // 2. ストレージパスを生成
            const timestamp = Date.now()
            const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
            const storagePath = `${user.id}/${timestamp}/${safeName}`

            setUploadProgress(10)

            // 3. Supabase Storageに直接アップロード (XHRで進捗取得)
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 75) + 10
                        setUploadProgress(pct)
                    }
                }
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve()
                    else {
                        try {
                            const res = JSON.parse(xhr.responseText)
                            reject(new Error(res.error?.message ?? `アップロード失敗 (${xhr.status})`))
                        } catch {
                            reject(new Error(`アップロード失敗 (${xhr.status})`))
                        }
                    }
                }
                xhr.onerror = () => reject(new Error('ネットワークエラー'))

                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
                const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${storagePath}`

                xhr.open('POST', uploadUrl)
                // Supabase Auth セッショントークンを取得して設定
                supabase.auth.getSession().then(({ data: { session } }) => {
                    xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token ?? ''}`)
                    xhr.setRequestHeader('Content-Type', selectedFile.type)
                    xhr.setRequestHeader('x-upsert', 'false')
                    xhr.send(selectedFile)
                }).catch(reject)
            })

            setUploadProgress(90)

            // 4. ジョブを作成してパイプライン開始
            const jobRes = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storage_key: storagePath,
                    filename: selectedFile.name,
                    size: selectedFile.size,
                    mime: selectedFile.type,
                }),
            })

            const jobJson = await jobRes.json()
            if (!jobRes.ok) throw new Error(jobJson.error?.message ?? 'ジョブ作成失敗')

            setUploadProgress(100)
            router.push(`/jobs/${jobJson.data.job_id}/processing`)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'エラーが発生しました')
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const formatBytes = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="font-bold text-base">📄 レシートスキャン</div>
                <button onClick={() => setShowGuide(true)} className="text-gray-400 border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">?</button>
            </header>

            <main className="flex-1 flex flex-col px-4 py-6 gap-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 mb-1">動画をアップロード</h1>
                    <p className="text-xs text-gray-500">領収書を撮影した動画をアップロードしてください</p>
                </div>

                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-4 cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50' : selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'}`}
                >
                    <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    {selectedFile ? (
                        <>
                            <div className="text-3xl">🎬</div>
                            <div className="text-center">
                                <p className="font-semibold text-green-700 text-sm">{selectedFile.name}</p>
                                <p className="text-xs text-gray-500 mt-1">{formatBytes(selectedFile.size)}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }} className="text-xs text-gray-400 underline">別のファイルを選ぶ</button>
                        </>
                    ) : (
                        <>
                            <div className="text-4xl text-gray-300">📁</div>
                            <div className="text-center">
                                <p className="font-semibold text-gray-600 text-sm">動画をここにドロップ</p>
                                <p className="text-xs text-gray-400 mt-1">またはタップしてファイルを選択</p>
                            </div>
                            <div className="text-xs text-gray-400 text-center">MP4 / MOV / AVI<br />最大200MB</div>
                        </>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ {error}</div>
                )}

                {uploading && (
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>{uploadProgress < 85 ? 'アップロード中...' : 'AI分析を開始中...'}</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                    </div>
                )}

                {!uploading && (
                    <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-blue-700 mb-2">📹 撮影のコツ</p>
                        <ul className="text-xs text-blue-600 space-y-1">
                            <li>・1枚ずつゆっくり映す（2〜3秒/枚）</li>
                            <li>・明るい場所で、手ブレに注意</li>
                            <li>・領収書全体が画角に収まるように</li>
                        </ul>
                    </div>
                )}
            </main>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
                <button onClick={handleUpload} disabled={!selectedFile || uploading} className="btn-primary w-full text-base">
                    {uploading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            処理中…
                        </span>
                    ) : '処理を開始する →'}
                </button>
            </div>

            {showGuide && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div className="bg-white w-full max-w-[430px] mx-auto rounded-t-2xl p-6 pb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg">📷 撮影ガイド</h2>
                            <button onClick={() => setShowGuide(false)} className="text-gray-400 text-xl">✕</button>
                        </div>
                        <ul className="space-y-3 text-sm text-gray-700">
                            <li className="flex gap-3"><span>①</span><span>領収書を平らな場所に置く</span></li>
                            <li className="flex gap-3"><span>②</span><span>明るい場所で正面から撮影（斜め・暗所はNG）</span></li>
                            <li className="flex gap-3"><span>③</span><span>1枚ずつ2〜3秒間止めてから次へ</span></li>
                            <li className="flex gap-3"><span>④</span><span>複数枚ある場合は連続して1本の動画に収める</span></li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}
