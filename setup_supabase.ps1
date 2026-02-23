#!/usr/bin/env pwsh
# ============================================================
# Supabase セットアップスクリプト (Windows PowerShell)
# .env.local に値を設定してから実行してください
# ============================================================

Write-Host "=== Supabase セットアップ ===" -ForegroundColor Cyan

# .env.local を読み込む
$envFile = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.local が見つかりません" -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#][^=]*)=(.*)$') {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($key, $value)
    }
}

$dbUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL")
if (-not $dbUrl -or $dbUrl -like "*[PROJECT]*") {
    Write-Host "ERROR: DATABASE_URL が未設定です。.env.local を確認してください" -ForegroundColor Red
    exit 1
}

# ① Prisma マイグレーション
Write-Host "`n[1/3] Prisma DBマイグレーション..." -ForegroundColor Yellow
npx prisma db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Prisma マイグレーション失敗" -ForegroundColor Red
    exit 1
}
Write-Host "✅ DBマイグレーション完了" -ForegroundColor Green

# ② Prisma Client 再生成
Write-Host "`n[2/3] Prisma Client 生成..." -ForegroundColor Yellow
npx prisma generate
Write-Host "✅ Prisma Client 生成完了" -ForegroundColor Green

Write-Host "`n[3/3] Storage バケット設定..." -ForegroundColor Yellow
Write-Host "  → supabase\setup_storage.sql をSupabaseダッシュボードのSQL Editorで実行してください" -ForegroundColor Yellow
Write-Host "  URL: https://supabase.com/dashboard → [プロジェクト] → SQL Editor" -ForegroundColor Cyan

Write-Host "`n=== セットアップ完了 ===" -ForegroundColor Green
Write-Host "次のステップ:" -ForegroundColor White
Write-Host "  1. supabase\setup_storage.sql をSQL Editorで実行"
Write-Host "  2. npm run dev でサーバー起動"
Write-Host "  3. http://localhost:3000 でアプリを確認"
