import type { Metadata } from "next";
import { MapExplorer } from "@/components/MapExplorer";
import {
  getBounds,
  getSceneTrees,
  getScenesWithoutTrees,
  getTreeSource,
} from "@/lib/trees";

export const metadata: Metadata = {
  title: "立木の位置 — data_mori",
  description: "測定した立木の位置と直径、対応する 3D Gaussian Splatting",
};

export default function MapPage() {
  return (
    <MapExplorer
      entries={getSceneTrees()}
      bounds={getBounds()}
      without={getScenesWithoutTrees()}
      source={getTreeSource()}
    />
  );
}
