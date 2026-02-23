import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'レシートスキャン | 動画で領収書かんたん処理',
  description: '動画をアップロードするだけで領収書を自動処理し、弥生会計向けExcelを生成します。',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-100 min-h-screen flex justify-center items-start py-4">
        {/* スマホ幅に制限したコンテナ */}
        <div className="w-full max-w-[430px] bg-white min-h-screen shadow-xl flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
