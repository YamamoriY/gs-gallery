"use client";

import { assetUrl } from "@/lib/scenes";
import type { ViewerProps } from "./registry";

/**
 * SuperSplat Viewer を iframe で埋め込む。
 *
 * ビューア本体は public/viewer/index.html に 1 枚だけ置いてあり
 * (scripts/build-viewer.mjs が書き出す)、どのシーンを開くかは
 * content クエリで渡す。
 */
export function SuperSplatViewer({ scene, className }: ViewerProps) {
  if (!scene.converted) return null;

  const viewer = assetUrl("viewer/index.html");
  const content = assetUrl(scene.converted.file);
  const src = `${viewer}?content=${encodeURIComponent(content)}`;

  return (
    <iframe
      key={scene.id}
      src={src}
      title={`${scene.title} の 3D ビュー`}
      className={className}
      allow="fullscreen; xr-spatial-tracking"
    />
  );
}
