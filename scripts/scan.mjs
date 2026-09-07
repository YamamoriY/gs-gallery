/**
 * 成果物フォルダを走査して data/scenes.json を作り直す。
 *
 *   node scripts/scan.mjs
 *
 * 自動で取れる情報 (点数・撮影日・元プロジェクト・画像枚数) はここで埋める。
 * タイトルや説明、緯度経度など人が書く情報は data/scenes.overrides.json に置き、
 * ここでマージする。scan を回し直しても手書きの情報は消えない。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  SOURCE_DIR,
  DATA_DIR,
  SCENES_JSON,
  OVERRIDES_JSON,
  GS_DIR,
  PUBLIC_DIR,
} from "./config.mjs";
import {
  findProject,
  parseSceneId,
  resolveProjectDir,
} from "./project-match.mjs";

/** PLY のヘッダだけ読んで点数と SH 次数を調べる */
function readPlyHeader(file) {
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(8192);
  const read = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);

  const text = buf.subarray(0, read).toString("latin1");
  const end = text.indexOf("end_header");
  const header = end === -1 ? text : text.slice(0, end);

  const vertexCount = Number(header.match(/element vertex (\d+)/)?.[1] ?? 0);
  const restCount = (header.match(/property float f_rest_\d+/g) ?? []).length;

  // f_rest はチャンネルあたり (deg+1)^2-1 個 × 3ch
  const shDegree = { 0: 0, 9: 1, 24: 2, 45: 3 }[restCount] ?? null;

  return { vertexCount, shDegree };
}

const IMAGE_RE = /\.(jpe?g|png|tiff?)$/i;

function countImages(project) {
  if (!project) return null;
  const dir = path.join(resolveProjectDir(project), "images");
  if (!fs.existsSync(dir)) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const flat = entries.filter((e) => e.isFile() && IMAGE_RE.test(e.name)).length;
  if (flat > 0) return flat;

  // リグ撮影は images/cam0/... と一段深いので全カメラを合計する
  return entries
    .filter((e) => e.isDirectory())
    .reduce(
      (a, e) =>
        a +
        fs.readdirSync(path.join(dir, e.name)).filter((f) => IMAGE_RE.test(f))
          .length,
      0,
    );
}

/** 変換済み SOG に実際に何点入っているかを splat-transform に聞く */
function countGaussians(sogPath) {
  try {
    const out = execFileSync(
      "npx",
      ["--yes", "@playcanvas/splat-transform", "--no-tty", "-q", sogPath,
       "--info", "json", "null"],
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    return JSON.parse(out).numGaussians ?? null;
  } catch {
    return null;
  }
}

/** scripts/thumbs.mjs が作ったカード画像を拾う */
function findThumb(id) {
  const rel = `thumbs/${id}.webp`;
  return fs.existsSync(path.join(PUBLIC_DIR, rel)) ? rel : null;
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`成果物フォルダが見つかりません: ${SOURCE_DIR}`);
    console.error("MORI_SOURCE_DIR で場所を指定できます。");
    process.exit(1);
  }

  const overrides = loadJson(OVERRIDES_JSON, {});
  const previous = new Map(
    (loadJson(SCENES_JSON, { scenes: [] }).scenes ?? []).map((s) => [s.id, s]),
  );

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".ply"))
    .sort();

  const scenes = files.map((file) => {
    const id = file.replace(/\.ply$/i, "");
    const full = path.join(SOURCE_DIR, file);
    const stat = fs.statSync(full);
    const { vertexCount, shDegree } = readPlyHeader(full);
    const { date, slug } = parseSceneId(id);
    const project = overrides[id]?.sourceProject ?? findProject(id);

    const sog = path.join(GS_DIR, `${id}.sog`);
    let converted = previous.get(id)?.converted ?? null;
    if (fs.existsSync(sog)) {
      const bytes = fs.statSync(sog).size;
      // 点数を数えるのは遅いので、ファイルが変わっていなければ使い回す。
      // 点数を持っていない古いカタログからは数え直す。
      converted =
        converted?.bytes === bytes && converted.gaussians != null
          ? converted
          : {
              file: `gs/${id}.sog`,
              bytes,
              gaussians: countGaussians(sog),
            };
    }

    return {
      id,
      // 人が上書きしなければファイル名をそのままタイトルにする
      title: overrides[id]?.title ?? slug,
      description: overrides[id]?.description ?? "",
      tags: overrides[id]?.tags ?? [],
      capturedAt: overrides[id]?.capturedAt ?? date,
      trainedAt: stat.mtime.toISOString().slice(0, 10),
      sourceProject: project,
      imageCount: overrides[id]?.imageCount ?? countImages(project),
      source: {
        file,
        bytes: stat.size,
        gaussians: vertexCount,
        shDegree,
      },
      converted,
      // data/survey-points.json の地点 id。書くと地図にピンが立つ
      pointId: overrides[id]?.pointId ?? null,
      thumbnail: overrides[id]?.thumbnail ?? findThumb(id),
      hidden: overrides[id]?.hidden ?? false,
    };
  });

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    SCENES_JSON,
    JSON.stringify({ generatedAt: new Date().toISOString(), scenes }, null, 2) + "\n",
  );

  const total = scenes.reduce((a, s) => a + s.source.gaussians, 0);
  console.log(`${scenes.length} シーンを書き出しました -> ${SCENES_JSON}`);
  console.log(`元データ合計: ${(total / 1e6).toFixed(1)}M ガウシアン`);
  const missing = scenes.filter((s) => !s.converted);
  if (missing.length) {
    console.log(`未変換 ${missing.length} 件: node scripts/convert.mjs で変換できます`);
  }
}

main();
