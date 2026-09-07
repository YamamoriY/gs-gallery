/**
 * MapLibre のワーカーを public/maplibre/ に置く。
 *
 * MapLibre は既定でワーカーの URL を自分自身の URL からの相対で組み立てる。
 *
 *   new URL("./maplibre-gl-worker.mjs", import.meta.url)
 *
 * バンドルすると import.meta.url は /_next/static/chunks/... になり、
 * そこにワーカーは出力されないので 404 になる。404 は HTML を返すため
 * "non-JavaScript MIME type" で落ち、タイルの読み込みが一切始まらない
 * (地図が真っ黒のまま、ネットワークにタイル要求も出ない)。
 *
 * なので自分で配って setWorkerUrl() で指す。ワーカーは
 * ./maplibre-gl-shared.mjs を相対で読むので 2 つ並べて置く。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_DIR } from "./config.mjs";

const pkgDir = path.resolve(
  fileURLToPath(import.meta.resolve("maplibre-gl")),
  "..",
);
const outDir = path.join(PUBLIC_DIR, "maplibre");
fs.mkdirSync(outDir, { recursive: true });

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
for (const name of files) {
  fs.copyFileSync(path.join(pkgDir, name), path.join(outDir, name));
}

const { version } = JSON.parse(
  fs.readFileSync(path.resolve(pkgDir, "..", "package.json"), "utf8"),
);
const total = files.reduce(
  (a, f) => a + fs.statSync(path.join(outDir, f)).size,
  0,
);
console.log(
  `MapLibre v${version} のワーカーを書き出しました -> ${outDir} (${(total / 1024).toFixed(0)} KB)`,
);
