import raw from "../../data/trees.json";
import { getScenes } from "./scenes";
import type { Scene } from "./types";

/** 現地で測った立木 1 本 (幹 1 本)。3DGS のシーンではなく現実の木のほう */
export interface Tree {
  /** 現地の立木番号。成果物の PLY 名と一致する */
  id: string;
  species: string;
  /** 胸高直径 (cm) */
  diameter: number | null;
  /** 樹高 (m)。測れたら入れる */
  height: number | null;
  /** 材積 (m3)。測れたら入れる */
  volume: number | null;
  latitude: number;
  longitude: number;
  /** 実測ではなく他の木から推定した位置か */
  positionEstimated: boolean;
  note: string;
}

export interface TreeSource {
  name: string;
  author: string;
  url: string;
  retrieved: string;
}

/** 1 シーンと、そこに写っている立木。萌芽更新した株は幹が複数になる */
export interface SceneTrees {
  scene: Scene;
  trees: Tree[];
  /** 地図に置く位置。含まれる立木の重心 */
  latitude: number;
  longitude: number;
  /** 位置が推定の立木を含むか */
  estimated: boolean;
}

const data = raw as { source: TreeSource; trees: Tree[] };

export function getTreeSource(): TreeSource {
  return data.source;
}

export function getTrees(): Tree[] {
  return data.trees;
}

export function getTree(id: string): Tree | undefined {
  return data.trees.find((t) => t.id === id);
}

function treesOf(scene: Scene): Tree[] {
  return scene.treeIds
    .map((id) => getTree(id))
    .filter((t): t is Tree => t !== undefined);
}

/** 立木が分かっているシーンだけを、地図に置ける形にして返す */
export function getSceneTrees(): SceneTrees[] {
  return getScenes()
    .map((scene) => {
      const trees = treesOf(scene);
      if (trees.length === 0) return null;
      return {
        scene,
        trees,
        latitude: trees.reduce((a, t) => a + t.latitude, 0) / trees.length,
        longitude: trees.reduce((a, t) => a + t.longitude, 0) / trees.length,
        estimated: trees.some((t) => t.positionEstimated),
      };
    })
    .filter((e): e is SceneTrees => e !== null);
}

export function getSceneTreesFor(scene: Scene): SceneTrees | undefined {
  return getSceneTrees().find((e) => e.scene.id === scene.id);
}

/** 立木 1 本と、それが写っているシーン */
export interface TreeWithScene {
  tree: Tree;
  scene: Scene;
  /** 同じ株から出ている他の幹 */
  siblings: Tree[];
}

/**
 * 立木を 1 本ずつ並べる。一覧はこちらを使う。
 *
 * シーン単位ではなく立木単位にしているのは、伐採する対象が幹だから。
 * 萌芽更新した株は 1 シーンに複数の幹が入っているので、
 * シーンを並べると幹の数と合わない。
 */
export function getTreesWithScene(): TreeWithScene[] {
  const out: TreeWithScene[] = [];
  for (const entry of getSceneTrees()) {
    for (const tree of entry.trees) {
      out.push({
        tree,
        scene: entry.scene,
        siblings: entry.trees.filter((t) => t.id !== tree.id),
      });
    }
  }
  return out;
}

/**
 * 一覧の 1 行。
 *
 * 幹ごとに 1 行が基本だが、直径も位置も分かっていない幹は互いに区別が
 * つかないので 1 行にまとめる (萌芽更新した株の 689・690・691 など)。
 * 同じ内容の行が並ぶだけで読みにくくなるため。
 */
export interface TreeRow {
  key: string;
  ids: string[];
  species: string;
  diameter: number | null;
  height: number | null;
  volume: number | null;
  latitude: number;
  longitude: number;
  positionEstimated: boolean;
  scene: Scene;
  /** 同じ株から出ていて、この行には含まれない幹 */
  siblingIds: string[];
}

export function getTreeRows(): TreeRow[] {
  const rows: TreeRow[] = [];

  for (const entry of getSceneTrees()) {
    const measured = entry.trees.filter((t) => t.diameter !== null);
    const unmeasured = entry.trees.filter((t) => t.diameter === null);

    const make = (trees: Tree[]): TreeRow => ({
      key: `${entry.scene.id}:${trees.map((t) => t.id).join("-")}`,
      ids: trees.map((t) => t.id),
      species: trees[0].species,
      diameter: trees[0].diameter,
      height: trees[0].height,
      volume: trees[0].volume,
      latitude: trees[0].latitude,
      longitude: trees[0].longitude,
      positionEstimated: trees.some((t) => t.positionEstimated),
      scene: entry.scene,
      siblingIds: entry.trees
        .filter((t) => !trees.includes(t))
        .map((t) => t.id),
    });

    for (const tree of measured) rows.push(make([tree]));
    if (unmeasured.length) rows.push(make(unmeasured));
  }

  return rows;
}

/** まだ立木が結び付いていないシーン */
export function getScenesWithoutTrees(): Scene[] {
  return getScenes().filter((s) => treesOf(s).length === 0);
}

/** 全立木が入る範囲。地図の初期表示に使う */
export function getBounds(): [[number, number], [number, number]] {
  const lats = data.trees.map((t) => t.latitude);
  const lngs = data.trees.map((t) => t.longitude);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** 現地に向かうためのリンク。スマホなら地図アプリが開く */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** 現地で無線で読み上げることを考えて度分秒でも出す */
export function formatDms(lat: number, lng: number): string {
  const dms = (v: number, pos: string, neg: string) => {
    const hemi = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d) * 60 - m) * 60;
    return `${d}°${String(m).padStart(2, "0")}'${s.toFixed(1)}"${hemi}`;
  };
  return `${dms(lat, "N", "S")} ${dms(lng, "E", "W")}`;
}
