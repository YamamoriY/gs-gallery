import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** リポジトリのルート (web/) */
export const ROOT = path.resolve(here, "..");

/** data_mori のルート。成果物 や projects, archive の親 */
export const DATA_ROOT = process.env.MORI_DATA_ROOT ?? path.resolve(ROOT, "..");

/** 元データ。data_mori/成果物 を既定にし、環境変数で差し替え可能にする */
export const SOURCE_DIR =
  process.env.MORI_SOURCE_DIR ?? path.join(DATA_ROOT, "成果物");

/** 撮影プロジェクト置き場。画像枚数などのメタ情報をここから拾う */
export const PROJECTS_DIR =
  process.env.MORI_PROJECTS_DIR ?? path.join(DATA_ROOT, "projects");

export const DATA_DIR = path.join(ROOT, "data");
export const SCENES_JSON = path.join(DATA_DIR, "scenes.json");
export const OVERRIDES_JSON = path.join(DATA_DIR, "scenes.overrides.json");

export const PUBLIC_DIR = path.join(ROOT, "public");

/** 変換途中の PLY 置き場。git には入れない */
export const CACHE_DIR = path.join(ROOT, ".cache");
export const GS_DIR = path.join(PUBLIC_DIR, "gs");

/**
 * 変換プリセット。
 * 「軽量重視: 約100万点・SH無し」が既定。
 * 品質を上げたくなったら decimate と harmonics を触るだけでよい。
 */
// sigma: 実体の範囲とみなす中央値からの標準偏差の倍数。
//        小さくするとノイズをよく切るが、シーンの端も削れる。
export const PRESETS = {
  light: { decimate: 1_000_000, harmonics: 0, minOpacity: 0.1, sigma: 3 },
  balanced: { decimate: 2_000_000, harmonics: 1, minOpacity: 0.05, sigma: 3 },
  high: { decimate: 4_000_000, harmonics: 2, minOpacity: 0.02, sigma: 4 },
};

/**
 * ノイズ除去 (scripts/denoise/denoise.py) の既定値。
 *
 * 20260902_691 で見比べて決めた値。これより強くすると葉が粒に分かれて
 * 疎になり、弱くすると緑の靄が残る。
 * シーンごとに変えたいときは data/scenes.overrides.json の denoise に書く。
 */
export const DENOISE = {
  minSamples: 20,
  minCluster: 5000,
  cell: 0.5,
  maxScale: 0.15,
  maxAniso: 30,
  minOpacity: 0.15,
};

/** denoise.py に渡すときのフラグ名 */
export const DENOISE_FLAGS = {
  sigma: "--sigma",
  minSamples: "--min-samples",
  minCluster: "--min-cluster",
  cell: "--cell",
  maxScale: "--max-scale",
  maxAniso: "--max-aniso",
  minOpacity: "--min-opacity",
};

export const DENOISE_DIR = path.join(ROOT, "scripts", "denoise");

export const DEFAULT_PRESET = process.env.MORI_PRESET ?? "light";
