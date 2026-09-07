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

/**
 * 現地の測定地点への参照。data/survey-points.json の id を指す。
 *
 * 緯度経度をシーンに直接持たせていないのは、萌芽更新した株では
 * 1 つの株から出た複数の幹をそれぞれ別番号で撮っていて、
 * 同じ座標に複数のシーンが対応するため。地点を実体にしておくと、
 * 直径などの測定値も 1 か所で持てる。
 */
export type ScenePointId = string;

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
  pointId: ScenePointId | null;
  thumbnail: string | null;
  hidden: boolean;
}

export interface SceneCatalog {
  generatedAt: string;
  scenes: Scene[];
}
