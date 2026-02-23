import { redirect } from 'next/navigation'

/** ルートURLはアップロード画面へリダイレクト */
export default function RootPage() {
  redirect('/upload')
}
