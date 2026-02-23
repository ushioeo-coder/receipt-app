import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'

function getModel() {
    return genAI.getGenerativeModel({ model: MODEL })
}

/** JSONレスポンスのパース（エラー時はnullを返す） */
function safeParseJson<T>(text: string): T | null {
    try {
        // コードブロックを除去
        const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
        return JSON.parse(cleaned) as T
    } catch {
        return null
    }
}

// ===== 型定義 =====

export interface DetectionResult {
    result: 'receipt' | 'partial' | 'none'
    confidence: number
}

export interface OcrResult {
    date: string | null          // YYYY-MM-DD
    store_name: string | null
    total_amount: number | null
    tax_info: string | null
    invoice_number: string | null
    ocr_raw_text: string | null
    confidence: number
}

export interface AccountResult {
    debit_account: string
    debit_account_candidate2: string | null
    confidence: number
    reason: string
}

// ===== 領収書検出 =====

export async function detectReceipt(imageBase64: string): Promise<DetectionResult> {
    const model = getModel()
    const prompt = `あなたは領収書検出AIです。
以下の画像を見て、「領収書またはレシートが写っているか」を判定してください。

判定基準：
- 明確に領収書・レシート・インボイスが映っている → receipt
- 領収書らしきものが写っているが不鮮明/一部のみ → partial
- 領収書は写っていない（手、背景、その他） → none

必ずJSON形式のみで回答してください：
{"result": "receipt", "confidence": 0.9}`

    try {
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
        ])
        const text = result.response.text()
        const parsed = safeParseJson<DetectionResult>(text)
        return parsed ?? { result: 'none', confidence: 0 }
    } catch {
        return { result: 'none', confidence: 0 }
    }
}

// ===== OCR + 構造化抽出 =====

export async function extractReceiptData(imageBase64: string): Promise<OcrResult> {
    const model = getModel()
    const prompt = `あなたはOCR専門AIです。
以下の領収書画像から情報を抽出してください。

抽出項目（見つからない場合はnullにする）：
- date: 取引日（ISO形式 YYYY-MM-DD）
- store_name: 店名・会社名
- total_amount: 合計金額（整数、円）
- tax_info: 税関連情報（例: "内税10%" "税抜1,000円"）
- invoice_number: インボイス登録番号（T + 13桁の形式）
- ocr_raw_text: 画像全体のOCRテキスト（改行区切り）
- confidence: 全体的な読み取り信頼度（0.0〜1.0）

注意事項：
- 金額は数字のみ（カンマ・円記号を除く）
- 日付が和暦の場合は西暦に変換（令和7年 → 2025年）
- 複数の合計金額候補がある場合は最大の金額を選ぶ

必ずJSON形式のみで回答してください。説明文は不要。`

    try {
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
        ])
        const text = result.response.text()
        const parsed = safeParseJson<OcrResult>(text)
        return parsed ?? {
            date: null, store_name: null, total_amount: null,
            tax_info: null, invoice_number: null, ocr_raw_text: null, confidence: 0,
        }
    } catch {
        return {
            date: null, store_name: null, total_amount: null,
            tax_info: null, invoice_number: null, ocr_raw_text: null, confidence: 0,
        }
    }
}

// ===== 勘定科目推定 =====

export async function classifyAccount(
    storeName: string | null,
    totalAmount: number | null,
    taxInfo: string | null,
    ocrText: string | null
): Promise<AccountResult> {
    const model = getModel()
    const prompt = `あなたは日本の税務・会計の専門家AIです。
以下の領収書情報から、最も適切な借方勘定科目を推定してください。

領収書情報:
- 店名: ${storeName ?? '不明'}
- 金額: ${totalAmount ?? '不明'}円
- 税情報: ${taxInfo ?? '不明'}
- OCRテキスト（抜粋）: ${ocrText?.substring(0, 200) ?? '不明'}

日本の一般的な勘定科目から選んでください：
消耗品費, 交際費, 会議費, 旅費交通費, 通信費,
車両費, 水道光熱費, 地代家賃, 広告宣伝費,
新聞図書費, 事務用品費, 修繕費, 外注費, その他

必ずJSON形式のみで回答してください：
{"debit_account": "消耗品費", "debit_account_candidate2": null, "confidence": 0.85, "reason": "理由"}`

    try {
        const result = await model.generateContent([prompt])
        const text = result.response.text()
        const parsed = safeParseJson<AccountResult>(text)
        return parsed ?? {
            debit_account: 'その他',
            debit_account_candidate2: null,
            confidence: 0.3,
            reason: 'AI判定失敗',
        }
    } catch {
        return {
            debit_account: 'その他',
            debit_account_candidate2: null,
            confidence: 0.3,
            reason: 'API呼び出し失敗',
        }
    }
}
