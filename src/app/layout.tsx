import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "data_mori — 3D Gaussian Splatting アーカイブ",
  description:
    "森林の 3D Gaussian Splatting スキャンをブラウザで見られるようにまとめたもの",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-baseline gap-4 px-6 py-5">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              data<span className="text-moss">_</span>mori
            </Link>
            <span className="text-sm text-paper-dim">
              3D Gaussian Splatting アーカイブ
            </span>
            <nav className="ml-auto flex gap-4 text-sm">
              <Link href="/" className="text-paper-dim hover:text-paper">
                一覧
              </Link>
              <Link href="/map/" className="text-paper-dim hover:text-paper">
                地図
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-paper-dim">
            地図は{" "}
            <a
              className="underline hover:text-paper"
              href="https://maps.gsi.go.jp/development/ichiran.html"
              target="_blank"
              rel="noreferrer"
            >
              国土地理院タイル
            </a>
            、ビューアは{" "}
            <a
              className="underline hover:text-paper"
              href="https://github.com/playcanvas/supersplat-viewer"
              target="_blank"
              rel="noreferrer"
            >
              SuperSplat Viewer
            </a>
            （MIT / PlayCanvas）
          </div>
        </footer>
      </body>
    </html>
  );
}
