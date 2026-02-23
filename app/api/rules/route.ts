import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, ok, err } from '@/lib/auth'

/** 店名を正規化�E��E角�E半角、不要記号除去�E�E*/
function normalizeStoreName(name: string): string {
    return name
        .normalize('NFKC')
        .replace(/[株式会社|�E�株�E�|(株)|有限会社|�E�有�E�|(朁E]/g, '')
        .replace(/[　\s]+/g, ' ')
        .trim()
        .toLowerCase()
}

/** POST /api/rules  E学習ルール保孁E*/
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUserId()
        const body = await request.json()
        const { store_name_key, debit_account, tax_category } = body

        if (!store_name_key || !debit_account) {
            return err({ code: 'VALIDATION_ERROR', message: '店名と科目は必要です', status: 422 })
        }

        const normalizedKey = normalizeStoreName(store_name_key)

        const rule = await prisma.rule.upsert({
            where: { user_id_store_name_key: { user_id: userId, store_name_key: normalizedKey } },
            create: {
                user_id: userId,
                store_name_key: normalizedKey,
                debit_account,
                tax_category: tax_category ?? null,
                hit_count: 0,
                last_used_at: new Date(),
            },
            update: {
                debit_account,
                tax_category: tax_category ?? null,
                last_used_at: new Date(),
                updated_at: new Date(),
            },
        })

        return ok(rule, 201)
    } catch (e) {
        return err(e)
    }
}

/** GET /api/rules  Eルール一覧 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthUserId()

        const rules = await prisma.rule.findMany({
            where: { user_id: userId },
            orderBy: { hit_count: 'desc' },
        })

        return ok({ rules })
    } catch (e) {
        return err(e)
    }
}
