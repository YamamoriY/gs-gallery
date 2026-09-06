/** data/scenes.json の型。scripts/scan.mjs が書き出す形と対応する */

export interface SceneSource {
  /** 元の PLY ファイル名 */
  file: string;
  bytes: number;
  gaussians: number;
  /** 球面調和の次数。0 なら視点非依存の色のみ */
  shDegree: number | null;
}

export interface SceneConverted {
  /** public/ からの相対パス */
  file: string;
  bytes: number;
  /** 実際に配信される点数。元データより大幅に少ない */
  gaussians: number | null;
}

/** 将来の地図連携用。overrides に書くと地図にピンが立つ */
export interface SceneLocation {
  latitude: number;
  longitude: number;
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  tags: string[];
  /** 撮影日 (YYYY-MM-DD) */
  capturedAt: string | null;
  /** 学習が終わった日 */
  trainedAt: string;
  /** projects/ 以下の元プロジェクト名 */
  sourceProject: string | null;
  imageCount: number | null;
  source: SceneSource;
  converted: SceneConverted | null;
  location: SceneLocation | null;
  thumbnail: string | null;
  hidden: boolean;
}

export interface SceneCatalog {
  generatedAt: string;
  scenes: Scene[];
}
