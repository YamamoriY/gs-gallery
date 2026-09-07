/**
 * 成果物のファイル名から、元になった撮影プロジェクトを引き当てる。
 * scan.mjs から使う。
 *
 * 命名は完全には揃っていない (20260831_15tree に対し 2026-08-31_15tree_osmo など)
 * ので何段か緩めながら探す。それでも当たらないものは
 * data/scenes.overrides.json に sourceProject を直接書く。
 */
import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR, DATA_ROOT } from "./config.mjs";

/** 20260902_693 → { date: "2026-09-02", slug: "693" } */
export function parseSceneId(id) {
  const m = id.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);
  if (!m) return { date: null, slug: id };
  return { date: `${m[1]}-${m[2]}-${m[3]}`, slug: m[4] };
}

function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function findProject(id) {
  const { date, slug } = parseSceneId(id);
  if (!date) return null;

  // 末尾の連番 (_2 など) は同じ素材の学習し直しなので落として探す
  const base = slug.replace(/_\d+$/, "");
  const dirs = listProjects();

  return (
    // 日付もスラッグも完全一致
    dirs.find((d) => d === `${date}_${slug}`) ??
    dirs.find((d) => d === `${date}_${base}`) ??
    // 日付が合っていて、スラッグで始まる (2026-08-31_15tree_osmo など)
    dirs.find((d) => d.startsWith(`${date}_${base}`)) ??
    // 日付がずれている (学習日が翌日になった場合など)
    dirs.find((d) => d.endsWith(`_${base}`)) ??
    null
  );
}

/**
 * プロジェクト名を実際のフォルダに解決する。
 *
 * 素の名前なら projects/ の下。overrides に "archive/xxx" のように
 * 区切りを含めて書いた場合は data_mori のルートからの相対として扱う。
 * projects/ に無い素材 (archive など) を指せるようにするため。
 */
export function resolveProjectDir(project) {
  if (!project) return null;
  return /[\\\/]/.test(project)
    ? path.resolve(DATA_ROOT, project)
    : path.join(PROJECTS_DIR, project);
}
