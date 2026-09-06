import catalog from "../../data/scenes.json";
import type { Scene, SceneCatalog } from "./types";

const data = catalog as SceneCatalog;

/** 変換済みで非公開でないシーンだけを新しい順に返す */
export function getScenes(): Scene[] {
  return data.scenes
    .filter((s) => !s.hidden && s.converted)
    .sort((a, b) => (b.capturedAt ?? "").localeCompare(a.capturedAt ?? ""));
}

export function getScene(id: string): Scene | undefined {
  return getScenes().find((s) => s.id === id);
}

/** basePath を前に付けた public 配下の URL を作る */
export function assetUrl(pathname: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/${pathname.replace(/^\//, "")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function formatCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
