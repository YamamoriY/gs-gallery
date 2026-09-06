"use client";

import { DEFAULT_VIEWER, viewers, type ViewerKind } from "./viewers/registry";
import type { Scene } from "@/lib/types";

export function SceneViewer({
  scene,
  kind = DEFAULT_VIEWER,
  className,
}: {
  scene: Scene;
  kind?: ViewerKind;
  className?: string;
}) {
  const Viewer = viewers[kind];
  return <Viewer scene={scene} className={className} />;
}
