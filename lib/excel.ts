import ExcelJS from 'exceljs'

// 値変換マップ
const PAYMENT_MAP: Record<string, string> = {
    cash: '現金',
    card: 'クレジットカード',
    transit: '電子マネー',
    transfer: '銀行振込',
    unknown: '不明',
}

const INVOICE_MAP: Record<string, string> = {
    yes: '適格（インボイスあり）',
    no: '非適格',
    unknown: '不明',
}

const TAX_MAP: Record<string, string> = {
    '課税10%': '課税（10%）',
    '課税8%（軽減）': '課税（8%軽減）',
    '非課税': '非課税',
    '不課税': '不課税',
    '免税': '免税',
}

const REVIEW_REASON_MAP: Record<string, string> = {
    date_missing: '日付不明',
    amount_missing: '金額不明',
    store_missing: '店名不明',
    invoice_unknown: 'インボイス不明',
    low_confidence: '読み取り精度が低い',
    debit_account_low_confidence: '科目推定の精度が低い',
    invalid_invoice_number: '登録番号の形式が不正',
}

// 簡易型定義（Prismaモデルに準拠）
interface ReceiptRow {
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
    needs_review: boolean
    review_reasons: string[]
    ocr_confidence: number
    memo: string | null
}

export async function generateExcel(receipts: ReceiptRow[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'レシートスキャンApp'
    wb.created = new Date()

    // ===== シート1: 仕訳データ =====
    const ws = wb.addWorksheet('仕訳データ')
    ws.columns = [
        { header: '取引日', key: 'date', width: 14 },
        { header: '借方科目', key: 'debit', width: 16 },
        { header: '借方金額', key: 'debit_amount', width: 14 },
        { header: '税区分', key: 'tax', width: 14 },
        { header: '取引先', key: 'partner', width: 20 },
        { header: '摘要', key: 'desc', width: 30 },
        { header: '貸方科目', key: 'credit', width: 16 },
        { header: '貸方金額', key: 'credit_amount', width: 14 },
        { header: '支払方法', key: 'payment', width: 16 },
        { header: 'インボイス', key: 'invoice', width: 20 },
        { header: '登録番号', key: 'inv_num', width: 18 },
        { header: '証憑ID', key: 'evidence', width: 24 },
        { header: '⚠要確認', key: 'review', width: 10 },
        { header: '科目候補2', key: 'debit2', width: 16 },
        { header: '信頼度', key: 'confidence', width: 10 },
        { header: 'メモ', key: 'memo', width: 20 },
    ]

    // ヘッダースタイル
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, size: 11 }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    // データ行
    receipts.forEach((r) => {
        const row = ws.addRow({
            date: new Date(r.final_date + 'T00:00:00'),
            debit: r.debit_account,
            debit_amount: r.final_total_amount,
            tax: TAX_MAP[r.tax_category] ?? r.tax_category,
            partner: r.partner_name,
            desc: r.description,
            credit: r.credit_account,
            credit_amount: r.final_total_amount,
            payment: PAYMENT_MAP[r.payment_method] ?? r.payment_method,
            invoice: INVOICE_MAP[r.invoice_flag],
            inv_num: r.invoice_number ?? '',
            evidence: r.evidence_id,
            review: r.needs_review ? '要確認' : '',
            debit2: r.debit_account_candidate2 ?? '',
            confidence: r.ocr_confidence,
            memo: r.memo ?? '',
        })

        row.getCell('date').numFmt = 'yyyy/mm/dd'
        row.getCell('debit_amount').numFmt = '#,##0'
        row.getCell('credit_amount').numFmt = '#,##0'
        row.getCell('confidence').numFmt = '0.00'

        if (r.needs_review) {
            row.getCell('review').fill = {
                type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' },
            }
        }
    })

    // ===== シート2: 要確認リスト =====
    const wsReview = wb.addWorksheet('要確認リスト')
    const reviewReceipts = receipts.filter((r) => r.needs_review)

    wsReview.columns = [
        { header: '証憑ID', key: 'evidence', width: 24 },
        { header: '店名', key: 'store', width: 20 },
        { header: '取引日', key: 'date', width: 14 },
        { header: '金額', key: 'amount', width: 12 },
        { header: '要確認理由', key: 'reasons', width: 40 },
    ]

    const reviewHeader = wsReview.getRow(1)
    reviewHeader.font = { bold: true }
    reviewHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } }

    reviewReceipts.forEach((r) => {
        const reasons = r.review_reasons
            .map((code) => REVIEW_REASON_MAP[code] ?? code)
            .join('、')
        wsReview.addRow({
            evidence: r.evidence_id,
            store: r.final_store_name,
            date: r.final_date,
            amount: r.final_total_amount,
            reasons,
        })
    })

    // ===== シート3: サマリ =====
    const wsSummary = wb.addWorksheet('サマリ')
    const totalAmount = receipts.reduce((s, r) => s + r.final_total_amount, 0)

    wsSummary.addRow(['出力日時', new Date().toLocaleString('ja-JP')])
    wsSummary.addRow(['総件数', receipts.length])
    wsSummary.addRow(['要確認件数', reviewReceipts.length])
    wsSummary.addRow(['合計金額', totalAmount])
    wsSummary.addRow([])
    wsSummary.addRow(['科目', '件数', '合計金額'])

    // 科目別集計
    const byAccount = new Map<string, { count: number; amount: number }>()
    receipts.forEach((r) => {
        const prev = byAccount.get(r.debit_account) ?? { count: 0, amount: 0 }
        byAccount.set(r.debit_account, {
            count: prev.count + 1,
            amount: prev.amount + r.final_total_amount,
        })
    })
    byAccount.forEach((val, key) => {
        wsSummary.addRow([key, val.count, val.amount])
    })

    wsSummary.getColumn(1).width = 20
    wsSummary.getColumn(2).width = 10
    wsSummary.getColumn(3).width = 14

    const buf = await wb.xlsx.writeBuffer()
    return Buffer.from(buf as ArrayBuffer)
}

export async function generateCsv(receipts: ReceiptRow[]): Promise<string> {
    const headers = [
        '取引日', '借方科目', '借方金額', '税区分', '取引先', '摘要',
        '貸方科目', '貸方金額', '支払方法', 'インボイス判定', '登録番号',
        '証憑ID', '要確認フラグ', '科目候補2', '信頼度', 'メモ',
    ]

    const esc = (v: string | number | boolean | null) => {
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s
    }

    const rows = receipts.map((r) =>
        [
            r.final_date,
            r.debit_account,
            r.final_total_amount,
            TAX_MAP[r.tax_category] ?? r.tax_category,
            r.partner_name,
            r.description,
            r.credit_account,
            r.final_total_amount,
            PAYMENT_MAP[r.payment_method] ?? r.payment_method,
            INVOICE_MAP[r.invoice_flag],
            r.invoice_number ?? '',
            r.evidence_id,
            r.needs_review ? '要確認' : '',
            r.debit_account_candidate2 ?? '',
            r.ocr_confidence.toFixed(2),
            r.memo ?? '',
        ]
            .map(esc)
            .join(',')
    )

    return '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\r\n')
}
