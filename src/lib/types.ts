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
  /** x, y, z の広がり (ユニット)。metresPerUnit を掛けると実寸になる */
  size: [number, number, number] | null;
}

/**
 * このシーンに写っている立木の番号。data/trees.json の id を指す。
 *
 * 緯度経度をシーンに直接持たせないのは、萌芽更新した株では 1 つの株から
 * 出た複数の幹をまとめて 1 回で撮っていて、幹ごとに番号も直径も違うため。
 * 立木を実体にしておくと、幹ごとの測定値をそのまま持てる。
 *
 * 既定では成果物のファイル名から決まる (687-688 なら 687 と 688)。
 */
export type TreeId = string;

export interface Scene {
  id: string;
  title: string;
  description: string;
  /** データに問題がある場合の注意書き。現地で誤らないよう目立たせて出す */
  warning: string | null;
  /**
   * 1 ユニットが何メートルか。
   *
   * 再構成のスケールは撮影ごとに任意なので、シーンごとに違う。
   * 写り込んでいるヘリポート (一辺 50cm) を物差しにして測っている。
   * 測れなかったシーンは null。
   */
  metresPerUnit: number | null;
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
  treeIds: TreeId[];
  hidden: boolean;
}

export interface SceneCatalog {
  generatedAt: string;
  scenes: Scene[];
}
