# gs-gallery

data_mori の 3D Gaussian Splatting アーカイブ。

`data_mori/成果物` の 3D Gaussian Splatting をブラウザで見られる形にまとめて公開するサイト。
公開先は https://yamamoriy.github.io/gs-gallery/ 。

## なぜ変換が要るか

学習の生の出力は 1 シーンあたり **1.2 GB 前後**（500万ガウシアン・SH次数3）ある。
そのままでは Web に置けないので、ノイズを落として間引いて SOG に詰め直す。

実測（`20260902_691`、元 407万点 / 1.00 GB）:

| | 点数 | サイズ |
|---|---|---|
| 元の PLY | 4,069,715 | 1.00 GB |
| ノイズ除去後 | 1,120,285 | — |
| 間引き後の PLY（100万点・SH無し） | 1,000,000 | 68 MB |
| **SOG（配信用）** | 1,000,000 | **約 12 MB** |

元の 1/80 前後。1 シーンあたり 2 分ほどで変換できる。

SOG は PlayCanvas の圧縮フォーマットで、中身は WebP テクスチャの ZIP。
「PLY 比 15〜20 倍」と言われるのは SH をフルに持った PLY との比較で、
SH を落としたあとの PLY からだと 5 倍前後になる。

## 技術スタック

- Next.js（静的書き出し）+ React + TypeScript + Tailwind CSS
- [SuperSplat Viewer](https://github.com/playcanvas/supersplat-viewer)（MIT）— 3DGS の描画
- [splat-transform](https://github.com/playcanvas/splat-transform) — 間引きと SOG 変換
- Python（numpy / scikit-learn / scipy）— ノイズ除去。uv で動かす
- GitHub Pages（GitHub Actions で自動デプロイ）

## 使い方

```
npm install
npm run viewer     # SuperSplat Viewer を public/viewer/ に書き出す
npm run convert    # 成果物の PLY を public/gs/*.sog に変換する（重い）
npm run scan       # data/scenes.json を作り直す
npm run dev
```

`npm run viewer` は一度でよい。新しいスキャンを足したら `convert` と `scan` を回す。
`convert` は [uv](https://docs.astral.sh/uv/) を使う。社内 CA などで証明書が
差し替えられている環境向けに `UV_SYSTEM_CERTS=1` を自動で立てている。

## ノイズ除去

3DGS の出力には 2 種類のノイズが混ざっている。どちらも別の対処が要る。

**遠方に飛んだ巨大なゴミ** — `20260831_15tree` では、これのせいで
バウンディングボックスが 4.84km x 11.7km x 3.39km まで広がっていた。
中央値 ± 3σ の箱で落とす。ゴミは数が少ないので σ はさほど膨らまない
（`20260902_691` では座標の最大値が 600 を超える一方 σ は 29）。

**実体の中に混ざる靄** — 極端に平たい板や針状のガウシアン。
`20260902_691` では異方性（最長軸÷最短軸）が中央値 12 倍、上位 10% で 132 倍、
最大 230 万倍あった。小さくても面積は稼ぐので、大きさだけでは取り切れない。
被覆量（面積×不透明度）で見ると上位 1% の点が全体の 19.5% を占めていた。

`scripts/denoise/denoise.py` が両方をまとめて処理する。

```
1. 中央値 ± 3σ の箱で遠方のゴミを落とす
2. DBSCAN で一定サイズ以上のクラスタ = 「芯」を取る
3. 芯を平面グリッド（0.5m）に焼いて footprint を作る
4. footprint の中にある点を 1. の点群から全部拾い直す
5. 形と不透明度で靄の原因になるガウシアンを落とす
```

要点は **DBSCAN を除去そのものではなく「実体がどこにあるか」の判定にだけ使う**こと。
DBSCAN の結果をそのまま採ると疎な葉が全部ノイズ判定になる
（`20260902_691` では最大クラスタが原データの 16.7% しかなく、
未分類が 67% だった）。footprint を取って拾い直すと 46% まで戻る。

`eps` は固定値ではなく、min_samples 番目の近傍までの距離の中央値から決める。
`20260902_691` で 0.244、`20260831_15tree` で 0.271 と、密度に追従する。

> gs-classifier の `denoise_2d_dbscan` を出発点にしている。
> ただし既定の `radius=0.1`（eps=0.2, min_samples=50）と
> 「最大クラスタだけ残す」戦略はこのデータには合わなかった。
> 単木のような密で連結した対象向けの値で、歩きながら撮った林分には
> 効きすぎる。

### シーンごとに変える

`data/scenes.overrides.json` の `denoise` で切り替える。

```json
{
  "20260831_15tree": { "denoise": "box" },
  "20260902_693":    { "denoise": { "maxScale": 0.2 } }
}
```

| 値 | 意味 |
|---|---|
| 省略 | 上の 1〜5 を全部やる（既定） |
| `"box"` | 遠方ノイズを箱で落とすだけ。実体は一切削らない |
| `false` | 何もしない |
| オブジェクト | 既定値を部分的に上書き |

`"box"` は全体を見せたいシーン向け。`20260831_15tree` と `20260831_15tree_2`
がこれを使っている。

### 品質の調整

`scripts/config.mjs` の `PRESETS`（点数と SH）と `DENOISE`（ノイズ除去）で決める。

```
npm run convert -- --preset balanced      # 200万点・SH1
npm run convert -- 20260902_693 --force   # 1シーンだけ作り直す
npm run convert -- --keep-ply             # 中間の PLY を .cache に残す
```

| プリセット | 点数 | SH | 想定サイズ |
|---|---|---|---|
| `light`（既定） | 100万 | 0 | 12 MB 前後 |
| `balanced` | 200万 | 1 | 40 MB 前後 |
| `high` | 400万 | 2 | 100 MB 超 |

`DENOISE` の既定値は `20260902_691` で見比べて決めた。
これより強くすると葉が粒に分かれて疎になり、弱くすると緑の靄が残る。

| | 既定 | 強くする | 弱くする |
|---|---|---|---|
| `maxScale` | 0.15 m | 0.12 | 0.20 |
| `maxAniso` | 30 | 20 | 50 |
| `minOpacity` | 0.15 | 0.20 | 0.10 |

元データの場所は環境変数 `MORI_DATA_ROOT` / `MORI_SOURCE_DIR` /
`MORI_PROJECTS_DIR` で差し替えられる。

## メタ情報の書き方

`scan` が自動で拾うのは点数・日付・元プロジェクト・写真枚数まで。
タイトルや説明は `data/scenes.overrides.json` に書く。`scan` を回し直しても消えない。

```json
{
  "20260902_693": {
    "title": "693 林班",
    "description": "下層植生の密なスギ林",
    "tags": ["スギ", "林班"],
    "location": { "latitude": 43.0, "longitude": 144.0 }
  }
}
```

成果物のファイル名と `projects/` のフォルダ名は完全には揃っていないので、
`scripts/project-match.mjs` が何段か緩めながら探す。当たらないものは
`sourceProject` を直接書く。`archive/2026-08-31_15tree_osmo_rigfocal` のように
区切りを含めて書くと `data_mori` のルートからの相対パスとして扱う。

## カード画像

いまは入れていない（一覧のカードはシーン名だけのプレースホルダ）。

```
npm run thumbs     # 撮影写真から public/thumbs/*.webp を作る
npm run scan       # scenes.json に反映
```

撮影写真から作る。3DGS をオフラインで描画してサムネイルにする手も試したが、
撮影軌跡から外れた視点だとガウシアンが板状に割れて見られたものではなかった
（オフラインのラスタライザはリニア値のまま出すのでビューアの見た目とも一致しない。
比較画像を作るときは sRGB に直す必要がある）。

360 度のエクイレクタングラー画像は歪みの小さい中央 35% だけを使う。
どの写真を使うかは `thumbnailSource` に画像ファイル名を書けば指定できる。

## 構成

```
scripts/         変換パイプライン
  config.mjs       元データの場所、品質プリセット、ノイズ除去の既定値
  project-match.mjs 成果物と撮影プロジェクトの対応付け
  convert.mjs      PLY → SOG。denoise.py と splat-transform を呼ぶ
  denoise/         ノイズ除去 (Python)
  scan.mjs         シーンカタログの生成
  thumbs.mjs       カード画像の生成
  build-viewer.mjs SuperSplat Viewer の書き出し
data/            scenes.json は生成物、scenes.overrides.json は手書き
public/gs/       変換済み SOG
src/app/         一覧ページと /scenes/[id] のビューアページ
src/components/viewers/  ビューアの差し替え口
```

## 分かっている問題

- **シーンによって天地が違う** — `20260902_691` は -y が上、`20260831_15tree` は
  +y が上。ビューアは +y を上と仮定するので、前者は初期表示が逆さまになる。
  `projects/*/realityscan/images.txt` の COLMAP カメラ姿勢から上方向を判定して
  `splat-transform -r` で揃えられるはずだが、まだ入れていない。

## 拡張の余地

- **地図連携** — `scenes.overrides.json` の `location` に緯度経度を書けるようにしてある。
  MapLibre のページを足せば、ピンから 3DGS に飛べる。
  [YamamoriY/Yamamori](https://github.com/YamamoriY/Yamamori) の `mapgs` が参考になる。
- **ビューアの差し替え** — `src/components/viewers/registry.ts` に登録する形にしてある。
  Babylon.js に替えるなら、Babylon は SOG を読めないので
  `scripts/convert.mjs` の出力を `.spz` に変える必要がある（splat-transform は対応済み）。
- **LOD** — splat-transform は LOD 出力に対応している。シーンが重くなったら検討する。
