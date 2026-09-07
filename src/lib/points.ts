import raw from "../../data/survey-points.json";
import { getScenes } from "./scenes";
import type { Scene } from "./types";

/** 現地で測った木。3DGS のシーンではなく、現実の株のほう */
export interface SurveyPoint {
  id: string;
  latitude: number;
  longitude: number;
  species: string;
  /** 胸高直径 (cm) */
  diameter: number | null;
  /** 樹高 (m) */
  height: number | null;
  note: string;
}

export interface SurveySource {
  name: string;
  author: string;
  url: string;
  retrieved: string;
}

/** 地点と、そこを撮ったシーン。萌芽更新した株は幹ごとに撮るので複数になる */
export interface PointWithScenes extends SurveyPoint {
  scenes: Scene[];
}

const data = raw as { source: SurveySource; points: SurveyPoint[] };

export function getSurveySource(): SurveySource {
  return data.source;
}

export function getPoints(): PointWithScenes[] {
  const scenes = getScenes();
  return data.points.map((p) => ({
    ...p,
    scenes: scenes.filter((s) => s.pointId === p.id),
  }));
}

export function getPoint(id: string | null): PointWithScenes | undefined {
  if (!id) return undefined;
  return getPoints().find((p) => p.id === id);
}

/** まだ地点に結び付いていないシーン */
export function getUnplacedScenes(): Scene[] {
  return getScenes().filter((s) => !s.pointId);
}

/** 全地点が入る範囲。地図の初期表示に使う */
export function getBounds(): [[number, number], [number, number]] {
  const lats = data.points.map((p) => p.latitude);
  const lngs = data.points.map((p) => p.longitude);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** 現地に向かうためのリンク。スマホなら地図アプリが開く */
export function directionsUrl(p: SurveyPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
}

/** 座標をそのまま読める形に。現地で無線で伝えることを考えて度分秒も出す */
export function formatLatLng(p: SurveyPoint): string {
  return `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
}
