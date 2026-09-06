import type { ComponentType } from "react";
import type { Scene } from "@/lib/types";
import { SuperSplatViewer } from "./SuperSplatViewer";

export interface ViewerProps {
  scene: Scene;
  className?: string;
}

/**
 * ビューアの差し替え口。
 *
 * いまは SOG を読む SuperSplat Viewer だけ。Babylon.js に替えたくなったら
 * ここに 'babylon' を足して registry に登録すれば、ページ側は触らずに済む。
 * ただし Babylon は SOG を読めないので、その時は
 * scripts/convert.mjs の出力を .spz に変える必要がある。
 */
export type ViewerKind = "supersplat";

export const viewers: Record<ViewerKind, ComponentType<ViewerProps>> = {
  supersplat: SuperSplatViewer,
};

export const DEFAULT_VIEWER: ViewerKind = "supersplat";
