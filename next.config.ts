import type { NextConfig } from "next";

// GitHub Pages は https://<user>.github.io/<repo>/ の下に置かれるので
// リポジトリ名ぶんのプレフィックスが要る。ローカル開発では空にしておく。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // 静的書き出し。GitHub Pages にはサーバが無いのでこれが必須
  output: "export",
  basePath,
  images: { unoptimized: true },
  // 末尾スラッシュありの方が Pages のルーティングと相性が良い
  trailingSlash: true,
};

export default nextConfig;
