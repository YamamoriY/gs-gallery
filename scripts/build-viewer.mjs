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

// index.html は renderViewerHtml() から。引数なしだと同梱の文書がそのまま返り、
// 配信ページ側の URL パラメータが content などを上書きする。
const html = await renderViewerHtml();
fs.writeFileSync(path.join(outDir, "index.html"), html);

// エンジン本体とスタイル。source map は 6.6MB あるので持っていかない
for (const name of ["index.js", "index.css"]) {
  fs.copyFileSync(path.join(srcDir, name), path.join(outDir, name));
}

// ビューアは起動時に ./settings.json を取りにいく。
// 無いと JSON の解析で落ちて真っ黒のままになるので必ず置く。
// 森の中に入って見るシーンなので environment で構える。
const settings = defaultSettings("environment");
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
