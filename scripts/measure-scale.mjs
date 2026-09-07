/**
 * 各シーンの 1 ユニットが何メートルかを測って data/scale.json に書く。
 *
 *   node scripts/measure-scale.mjs                 未計測のシーン
 *   node scripts/measure-scale.mjs 20260902_692    シーンを指定
 *   node scripts/measure-scale.mjs --force         全部測り直す
 *
 * 再構成のスケールは撮影ごとに任意なので、シーンごとに測る必要がある。
 * 大きさの分かっている物 (橙色のヘリポート、一辺 50cm) が写っているので、
 * それを物差しにする。
 *
 * 配信用の SOG を PLY に戻してから測る。元の 1.2GB を読み直すより速く、
 * 実際に配信しているデータそのものを測ることにもなる。
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  GS_DIR,
  CACHE_DIR,
  DATA_DIR,
  PYTOOLS_DIR,
  OVERRIDES_JSON,
} from "./config.mjs";

const SCALE_JSON = path.join(DATA_DIR, "scale.json");

const args = process.argv.slice(2);
const force = args.includes("--force");
const targets = args.filter((a) => !a.startsWith("--"));

function run(cmd, cmdArgs, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      shell: process.platform === "win32",
      env: { ...process.env },
    });
    let out = "";
    if (capture) child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`終了コード ${code}`)),
    );
  });
}

async function measure(id) {
  const sog = path.join(GS_DIR, `${id}.sog`);
  const work = path.join(CACHE_DIR, `${id}.scale.ply`);

  await run("npx", [
    "--yes", "@playcanvas/splat-transform", "-w", "--no-tty", "-q", sog, work,
  ]);

  process.env.UV_SYSTEM_CERTS ??= "1";
  const json = await run("uv", [
    "run", "--project", PYTOOLS_DIR,
    "python", path.join(PYTOOLS_DIR, "measure_scale.py"), work,
  ], true);

  fs.rmSync(work, { force: true });
  return JSON.parse(json);
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const overrides = fs.existsSync(OVERRIDES_JSON)
    ? JSON.parse(fs.readFileSync(OVERRIDES_JSON, "utf8"))
    : {};
  const previous = fs.existsSync(SCALE_JSON)
    ? JSON.parse(fs.readFileSync(SCALE_JSON, "utf8")).scenes ?? {}
    : {};

  const all = fs
    .readdirSync(GS_DIR)
    .filter((f) => f.endsWith(".sog") && !f.startsWith("_"))
    .map((f) => f.replace(/\.sog$/, ""))
    .sort();

  const list = (targets.length ? targets : all).filter(
    (id) => force || targets.length || previous[id] === undefined,
  );

  const scenes = { ...previous };
  for (const [i, id] of list.entries()) {
    process.stdout.write(`[${i + 1}/${list.length}] ${id} ... `);
    try {
      const r = await measure(id);
      scenes[id] = r;
      console.log(
        r.found
          ? `1 ユニット = ${r.metresPerUnit} m ` +
            `(${r.size[0]}x${r.size[1]} / 正方形度 ${r.squareness})`
          : `見つからず (${r.reason})`,
      );
    } catch (err) {
      console.log(`失敗: ${err.message}`);
    }
  }

  fs.writeFileSync(
    SCALE_JSON,
    JSON.stringify(
      {
        _comment:
          "scripts/measure-scale.mjs が書き出す。橙色のヘリポート (一辺 50cm) を" +
          "物差しにして測った 1 ユニットあたりのメートル数。" +
          "手で決めたい場合は scenes.overrides.json の metresPerUnit が優先される。",
        generatedAt: new Date().toISOString(),
        markerSideMetres: 0.5,
        scenes,
      },
      null,
      2,
    ) + "\n",
  );

  const found = Object.values(scenes).filter((s) => s.found).length;
  console.log(`\n${found}/${Object.keys(scenes).length} シーンで目印が見つかりました`);
  console.log(`見つからなかったシーンは overrides に metresPerUnit を直接書けます`);
  const manual = Object.entries(overrides).filter(([, v]) => v.metresPerUnit);
  if (manual.length) {
    console.log(`手で指定済み: ${manual.map(([k]) => k).join(", ")}`);
  }
}

main();
