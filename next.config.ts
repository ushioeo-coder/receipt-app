import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ネイティブバイナリ・DB系パッケージはサーバーバンドル対象外
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/client/runtime",
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
    "exceljs",
  ],
  // Turbopack設定（Next.js 16デフォルト）
  turbopack: {},
};

export default nextConfig;
