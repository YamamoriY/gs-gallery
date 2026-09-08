import raw from "../../data/plots.json";
import { getScenes } from "./scenes";
import type { Scene } from "./types";

/**
 * 標準地。林分をまとめて撮ったスキャンに対応する。
 *
 * 単木 (trees.ts) とは別に持っている。求められる情報が違うため。
 * 単木は番号と胸高直径で個体を指すが、標準地は林班番号と面積で区画を指す。
 *
 * 広域のスキャンから幹ごとに分割できるようになれば、標準地を親にして
 * その中の単木を並べる形にできる。いまはその技術が無いので切り離してある。
 */
export interface Plot {
  id: string;
  /** 林班番号 */
  compartment: string | null;
  /** 小班番号 */
  subCompartment: string | null;
  /** 面積 (ha)。実測値のみ。footprint からの計算値は入れない */
  areaHectares: number | null;
  /** 形状の説明 */
  shape: string;
  latitude: number | null;
  longitude: number | null;
  note: string;
}

export interface PlotWithScene {
  plot: Plot;
  scene: Scene;
}

const data = raw as { plots: Plot[] };

export function getPlots(): Plot[] {
  return data.plots;
}

export function getPlot(id: string | null): Plot | undefined {
  if (!id) return undefined;
  return data.plots.find((p) => p.id === id);
}

/** 標準地とそれを撮ったシーン。シーンが無い標準地は出さない */
export function getPlotsWithScene(): PlotWithScene[] {
  const scenes = getScenes();
  return data.plots
    .map((plot) => {
      const scene = scenes.find((s) => s.plotId === plot.id);
      return scene ? { plot, scene } : null;
    })
    .filter((e): e is PlotWithScene => e !== null);
}

/** 林班番号の表示。小班があれば合わせて出す */
export function formatCompartment(plot: Plot): string {
  if (!plot.compartment) return "未登録";
  return plot.subCompartment
    ? `${plot.compartment} 林班 ${plot.subCompartment} 小班`
    : `${plot.compartment} 林班`;
}
