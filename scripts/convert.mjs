/**
 * 成果物の PLY を Web 配信用の SOG に変換する。
 *
 *   node scripts/convert.mjs                 未変換のシーンを全部
 *   node scripts/convert.mjs 20260902_693    シーンを指定
 *   node scripts/convert.mjs --force         変換済みも作り直す
 *   node scripts/convert.mjs --preset high   品質プリセットを変える
 *   node scripts/convert.mjs --keep-ply      中間の PLY を .cache に残す
 *
 * 二段構え。
 *   ノイズ除去は scripts/denoise/denoise.py (Python)。形と密度を見るので
 *   splat-transform では書けない。uv 経由で呼ぶ。
 *   間引きと圧縮は splat-transform。間引きは「最後のアクションで、かつ
 *   出力が .ply」でないと受け付けてもらえないので 2 回に分けている。
 *
 * シーンによってノイズ除去を変えたいときは data/scenes.overrides.json に
 * denoise を書く。
 *   "denoise": false    何もしない
 *   "denoise": "box"    遠方ノイズを箱で落とすだけ (実体は一切削らない)
 *   "denoise": { "maxScale": 0.2 }   既定値を部分的に上書き
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  SOURCE_DIR,
  GS_DIR,
  CACHE_DIR,
  DENOISE,
  DENOISE_DIR,
  DENOISE_FLAGS,
  PRESETS,
  DEFAULT_PRESET,
  OVERRIDES_JSON,
  SCENES_JSON,
} from "./config.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const keepIntermediate = args.includes("--keep-ply");
const presetName = (() => {
  const i = args.indexOf("--preset");
  return i === -1 ? DEFAULT_PRESET : args[i + 1];
})();
const targets = args.filter((a, i) => {
  if (a.startsWith("--")) return false;
  if (args[i - 1] === "--preset") return false;
  return true;
});

const preset = PRESETS[presetName];
if (!preset) {
  console.error(
    `未知のプリセット: ${presetName} (${Object.keys(PRESETS).join(", ")})`,
  );
  process.exit(1);
}

const overrides = fs.existsSync(OVERRIDES_JSON)
  ? JSON.parse(fs.readFileSync(OVERRIDES_JSON, "utf8"))
  : {};

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function spawnAsync(cmd, cmdArgs, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        // 500万点の PLY を読むのでヒープを広げておく
        NODE_OPTIONS:
          `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=12288`.trim(),
      },
    });

    let out = "";
    if (capture) child.stdout.on("data", (d) => (out += d));

    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`終了コード ${code}`)),
    );
  });
}

const splat = (cmdArgs, opts) =>
  spawnAsync("npx", ["--yes", "@playcanvas/splat-transform", ...cmdArgs], opts);

/**
 * 実体が収まっている範囲を測る。
 *
 * 3DGS はシーンから遠く離れたところに巨大な半透明のゴミを作る。
 * 20260831_15tree では、そのせいでバウンディングボックスが
 * 4.8km x 11.7km まで広がっていた。中央値 ± k×標準偏差を実体の範囲とみなす。
 * ゴミは数が少ないので標準偏差はさほど膨らまない
 * (20260902_691 では座標の最大値が 600 を超える一方 σ は 29 だった)。
 */
async function measureBox(input, sigma) {
  const json = await splat(["--no-tty", "-q", input, "--stats", "json", "null"], {
    capture: true,
  });
  const lod = JSON.parse(json).stats[0];
  // 列の並びは決め打ちせず columns から引く
  const axes = ["x", "y", "z"].map((name) => {
    const i = lod.columns.indexOf(name);
    if (i === -1) throw new Error(`統計に ${name} が無い`);
    return i;
  });
  const at = (row) => axes.map((i) => row[i]);

  const median = at(lod.data.median);
  const dev = at(lod.data.stdDev);
  const min = median.map((m, i) => m - dev[i] * sigma);
  const max = median.map((m, i) => m + dev[i] * sigma);

  return {
    arg: [...min, ...max].map((v) => v.toFixed(3)).join(","),
    size: max.map((v, i) => v - min[i]),
  };
}

/** denoise.py を uv 経由で呼ぶ */
async function denoise(input, output, settings) {
  const flags = Object.entries(DENOISE_FLAGS).flatMap(([key, flag]) =>
    settings[key] === undefined ? [] : [flag, String(settings[key])],
  );
  // 社内 CA などで証明書が差し替えられている環境だと uv の既定のトラスト
  // ストアでは弾かれる。OS のものを見に行かせる。
  process.env.UV_SYSTEM_CERTS ??= "1";

  await spawnAsync("uv", [
    "run",
    "--project", DENOISE_DIR,
    "python", path.join(DENOISE_DIR, "denoise.py"),
    input,
    output,
    ...flags,
  ]);
}

/** そのシーンにどのノイズ除去を掛けるか */
function denoiseMode(id) {
  const setting = overrides[id]?.denoise;
  if (setting === false) return { mode: "none" };
  if (setting === "box") return { mode: "box" };
  return {
    mode: "full",
    settings: { ...DENOISE, sigma: preset.sigma, ...(setting ?? {}) },
  };
}

async function convert(id) {
  const input = path.join(SOURCE_DIR, `${id}.ply`);
  const output = path.join(GS_DIR, `${id}.sog`);
  const cleaned = path.join(CACHE_DIR, `${id}.clean.ply`);
  const decimated = path.join(CACHE_DIR, `${id}.dec.ply`);

  if (!fs.existsSync(input)) {
    console.error(`  元ファイルなし: ${input}`);
    return null;
  }
  if (fs.existsSync(output) && !force) {
    console.log("  変換済みなので飛ばす (--force で作り直し)");
    return fs.statSync(output).size;
  }

  const inSize = fs.statSync(input).size;
  const { mode, settings } = denoiseMode(id);

  // 掃除。何をするかはシーンごとに変わる
  let source = input;
  const pre = ["-N"]; // NaN や回転が壊れた点はどのモードでも落とす

  if (mode === "full") {
    console.log("  [1/3] ノイズ除去");
    await denoise(input, cleaned, settings);
    source = cleaned;
  } else if (mode === "box") {
    console.log("  [1/3] 遠方ノイズの範囲を測る");
    const box = await measureBox(input, preset.sigma);
    console.log(`        ${box.size.map((v) => v.toFixed(0)).join(" x ")} に切る`);
    pre.push("-B", box.arg, "-V", `opacity,gt,${preset.minOpacity}`);
  } else {
    console.log("  [1/3] ノイズ除去なし");
  }

  // 間引き。マージなので単純な間引きより形が残る
  console.log("  [2/3] 間引き");
  await splat([
    "-w",
    "--no-tty",
    source,
    ...pre,
    "-H", String(preset.harmonics),
    "-d", String(preset.decimate),
    decimated,
  ]);

  console.log("  [3/3] SOG に圧縮");
  await splat(["-w", "--no-tty", decimated, output]);

  if (!keepIntermediate) {
    fs.rmSync(cleaned, { force: true });
    fs.rmSync(decimated, { force: true });
  }

  const outSize = fs.statSync(output).size;
  console.log(
    `  ${mb(inSize)} -> ${mb(outSize)} (1/${Math.round(inSize / outSize)})`,
  );
  return outSize;
}

async function main() {
  fs.mkdirSync(GS_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const all = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".ply"))
    .map((f) => f.replace(/\.ply$/i, ""))
    .sort();

  const list = targets.length ? targets : all;
  const unknown = list.filter((id) => !all.includes(id));
  if (unknown.length) {
    console.error(`成果物に無いシーン: ${unknown.join(", ")}`);
    process.exit(1);
  }

  // アーカイブから外したシーンは変換しない。名前を直接指定されたときだけやる
  if (!targets.length) {
    const hidden = list.filter((id) => overrides[id]?.hidden);
    if (hidden.length) {
      console.log(`hidden なので飛ばす: ${hidden.join(", ")}`);
      list.splice(0, list.length, ...list.filter((id) => !overrides[id]?.hidden));
    }
  }

  console.log(
    `プリセット ${presetName}: ${preset.decimate.toLocaleString()}点 / SH${preset.harmonics}`,
  );
  console.log(`${list.length} シーンを変換します\n`);

  let ok = 0;
  let totalOut = 0;
  const failed = [];

  for (const [i, id] of list.entries()) {
    console.log(`[${i + 1}/${list.length}] ${id}`);
    try {
      const size = await convert(id);
      if (size) {
        ok += 1;
        totalOut += size;
      }
    } catch (err) {
      console.error(`  失敗: ${err.message}`);
      failed.push(id);
    }
    console.log("");
  }

  console.log(`完了 ${ok}/${list.length} シーン、合計 ${mb(totalOut)}`);
  if (failed.length) console.log(`失敗: ${failed.join(", ")}`);
  console.log(
    `node scripts/scan.mjs で ${path.basename(SCENES_JSON)} を更新してください`,
  );
}

main();
