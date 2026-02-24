const { Pool } = require('pg')

// セッションモードポーラー経由（DDL用）
const pool = new Pool({
    connectionString: 'postgresql://postgres.guhyxfrdgxrnkilaxffd:3961106.ushio@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
})

const policies = [
    {
        name: 'videos_insert',
        sql: `CREATE POLICY "videos_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text)`
    },
    {
        name: 'videos_select',
        sql: `CREATE POLICY "videos_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text)`
    },
    {
        name: 'videos_delete',
        sql: `CREATE POLICY "videos_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text)`
    },
    {
        name: 'receipt_images_insert',
        sql: `CREATE POLICY "receipt_images_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'receipt-images' AND (storage.foldername(name))[1] = auth.uid()::text)`
    },
    {
        name: 'receipt_images_select',
        sql: `CREATE POLICY "receipt_images_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'receipt-images' AND (storage.foldername(name))[1] = auth.uid()::text)`
    },
    {
        name: 'exports_insert',
        sql: `CREATE POLICY "exports_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text)`
    },
    {
        name: 'exports_select',
        sql: `CREATE POLICY "exports_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text)`
    },
]

async function run() {
    const client = await pool.connect()
    try {
        for (const policy of policies) {
            try {
                await client.query(policy.sql)
                console.log(`✅ Created policy: ${policy.name}`)
            } catch (e) {
                if (e.message.includes('already exists')) {
                    console.log(`⚠️  Already exists: ${policy.name}`)
                } else {
                    console.error(`❌ Failed ${policy.name}:`, e.message)
                }
            }
        }
        console.log('\n🎉 Done! Storage RLS policies configured.')
    } finally {
        client.release()
        await pool.end()
    }
}

run().catch(console.error)
