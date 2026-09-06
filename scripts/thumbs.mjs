/**
 * ギャラリーのカード画像を作る。
 *
 *   node scripts/thumbs.mjs                 サムネイルの無いシーンぶん
 *   node scripts/thumbs.mjs 20260902_691    シーンを指定
 *   node scripts/thumbs.mjs --force         全部作り直す
 *
 * 3DGS をオフラインで描画してサムネイルにする手も試したが、撮影軌跡から
 * 外れた視点だとガウシアンが板状に割れて見られたものではなかった。
 * 元の撮影写真から作る方が速いし、実際きれいに写っている。
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  SOURCE_DIR,
  PUBLIC_DIR,
  OVERRIDES_JSON,
} from "./config.mjs";
import { findProject, resolveProjectDir } from "./project-match.mjs";

const WIDTH = 800;
const HEIGHT = 450; // 16:9

const args = process.argv.slice(2);
const force = args.includes("--force");
const targets = args.filter((a) => !a.startsWith("--"));

const thumbDir = path.join(PUBLIC_DIR, "thumbs");

function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_JSON)) return {};
  return JSON.parse(fs.readFileSync(OVERRIDES_JSON, "utf8"));
}

const IMAGE_RE = /\.(jpe?g|png|tiff?)$/i;

/** 撮影プロジェクトの images/ から 1 枚選ぶ。既定は軌跡の真ん中あたり */
function pickImage(project, preferred) {
  const dir = path.join(resolveProjectDir(project), "images");
  if (!fs.existsSync(dir)) return null;

  let files = fs.readdirSync(dir).filter((f) => IMAGE_RE.test(f)).sort();

  // リグ撮影は images/cam0/... のように一段深い。その場合は最初のカメラを使う
  if (files.length === 0) {
    const sub = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()[0];
    if (!sub) return null;
    const subDir = path.join(dir, sub);
    files = fs.readdirSync(subDir).filter((f) => IMAGE_RE.test(f)).sort();
    if (files.length === 0) return null;
    return pick(subDir, files, preferred);
  }

  return pick(dir, files, preferred);
}

function pick(dir, files, preferred) {

  if (preferred) {
    const hit = files.find((f) => f === preferred);
    if (hit) return path.join(dir, hit);
    console.warn(`  指定の画像が見つからない: ${preferred}`);
  }
  // 撮り始めは準備中の絵が混ざりがちなので真ん中を採る
  return path.join(dir, files[Math.floor(files.length / 2)]);
}

async function makeThumb(src, dest) {
  const image = sharp(src);
  const { width, height } = await image.metadata();

  // 2:1 前後なら 360 度のエクイレクタングラー。
  // 端ほど歪むので、歪みの小さい中央だけを使う。
  const equirect = width / height >= 1.9;
  const cropWidth = Math.round(equirect ? width * 0.35 : width);
  const cropHeight = Math.min(
    Math.round((cropWidth * HEIGHT) / WIDTH),
    height,
  );

  await image
    .extract({
      left: Math.round((width - cropWidth) / 2),
      top: Math.round((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    })
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(dest);

  return fs.statSync(dest).size;
}

async function main() {
  fs.mkdirSync(thumbDir, { recursive: true });
  const overrides = loadOverrides();

  const all = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".ply"))
    .map((f) => f.replace(/\.ply$/i, ""))
    .sort();

  const list = targets.length ? targets : all;
  let made = 0;

  for (const id of list) {
    const dest = path.join(thumbDir, `${id}.webp`);
    if (fs.existsSync(dest) && !force) continue;

    console.log(id);
    const project = overrides[id]?.sourceProject ?? findProject(id);
    if (!project) {
      console.log("  元プロジェクトが分からないので飛ばす");
      continue;
    }

    const src = pickImage(project, overrides[id]?.thumbnailSource);
    if (!src) {
      console.log(`  ${project}/images に画像が無い`);
      continue;
    }

    const size = await makeThumb(src, dest);
    console.log(`  ${path.basename(src)} -> ${(size / 1024).toFixed(0)} KB`);
    made += 1;
  }

  console.log(`\n${made} 枚作りました`);
}

main();
