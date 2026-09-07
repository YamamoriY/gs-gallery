import type { Metadata } from "next";
import { MapExplorer } from "@/components/MapExplorer";
import {
  getBounds,
  getPoints,
  getSurveySource,
  getUnplacedScenes,
} from "@/lib/points";

export const metadata: Metadata = {
  title: "地図 — data_mori",
  description: "測定した木の位置と、対応する 3D Gaussian Splatting のシーン",
};

export default function MapPage() {
  return (
    <MapExplorer
      points={getPoints()}
      bounds={getBounds()}
      unplaced={getUnplacedScenes()}
      source={getSurveySource()}
    />
  );
}
