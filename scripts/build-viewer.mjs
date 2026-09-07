/**
 * SuperSplat Viewer (MIT) を public/viewer/ に書き出す。
 *
 *   node scripts/build-viewer.mjs
 *
 * ビューア本体は 1 組だけ置いて、シーンごとの差は ?content=... のクエリで渡す。
 * 14 シーンぶんビューアを複製しないで済む。
 *
 * index.js に PlayCanvas エンジンごと入っているので、これだけで完結する
 * (外部を見にいくのは WebXR コントローラのプロファイルだけ)。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderViewerHtml } from "@playcanvas/supersplat-viewer";
import {
  defaultSettings,
  validateSettings,
} from "@playcanvas/supersplat-viewer/settings";
import { PUBLIC_DIR } from "./config.mjs";

// package.json は exports に載っていないので直接は解決できない。
// ESM のエントリ (dist/index.js) から 2 つ上がパッケージのルート。
const pkgDir = path.resolve(
  fileURLToPath(import.meta.resolve("@playcanvas/supersplat-viewer")),
  "..",
  "..",
);
const srcDir = path.join(pkgDir, "public");
const outDir = path.join(PUBLIC_DIR, "viewer");

fs.mkdirSync(outDir, { recursive: true });

// ビューアの背景色。サイトが明るい配色なので白で揃える。
// 0..1 で指定する (settings の background.color と同じ形式)。
const BACKGROUND = [1, 1, 1];

// index.html は renderViewerHtml() から。
// backgroundColor は最初のフレームが出る前の下地に使われる。
// 渡さないと黒地から白へ切り替わって一瞬ちらつく。
const html = await renderViewerHtml({ backgroundColor: BACKGROUND });
fs.writeFileSync(path.join(outDir, "index.html"), html);

// エンジン本体とスタイル。source map は 6.6MB あるので持っていかない
for (const name of ["index.js", "index.css"]) {
  fs.copyFileSync(path.join(srcDir, name), path.join(outDir, name));
}

// ビューアは起動時に ./settings.json を取りにいく。
// 無いと JSON の解析で落ちて真っ黒のままになるので必ず置く。
// 1 本の木を外から撮ったシーンなので object で構える。
// environment だと空間の中に入った視点になり、株全体が画面に入らない。
const settings = defaultSettings("object");
settings.background.color = BACKGROUND;
validateSettings(settings, { limits: true });
fs.writeFileSync(
  path.join(outDir, "settings.json"),
  JSON.stringify(settings, null, 2) + "\n",
);

// ライセンス表示を一緒に置いておく
fs.copyFileSync(path.join(pkgDir, "LICENSE"), path.join(outDir, "LICENSE"));

const total = fs
  .readdirSync(outDir)
  .reduce((a, f) => a + fs.statSync(path.join(outDir, f)).size, 0);

const { version } = JSON.parse(
  fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"),
);
console.log(
  `SuperSplat Viewer v${version} を書き出しました -> ${outDir} (${(total / 1024 / 1024).toFixed(1)} MB)`,
);
