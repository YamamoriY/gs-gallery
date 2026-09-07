"""
3DGS の PLY からノイズを落とす。

  python denoise.py 入力.ply 出力.ply

手順:
  1. 中央値 ± sigma×標準偏差 の箱で、遠方に飛んだ巨大なゴミを落とす
  2. DBSCAN で一定サイズ以上のクラスタ = 「芯」を取る
     除去そのものではなく、実体がどこにあるかの判定にだけ使う
  3. 芯を平面グリッドに焼いて footprint を作る
  4. footprint の中にある点を 1. の点群から全部拾い直す
     DBSCAN が未分類として捨てた疎な葉がここで戻る
  5. 形と不透明度でガウシアンを落とす (既定では掛けない)

5 は既定で無効。3DGS は硬い面を「面に沿った平たい円盤」で表すので、
幹の樹皮は本質的に異方性が高い。靄を消そうとして異方性で切ると、
幹の表面そのものが消えて中が透ける。黒い背景では幹が黒く沈むため
気付けなかったが、白い背景にすると一目で分かる。

20260902_693 で切り分けたところ、形状フィルタを外すだけで
点数も容量も変えずに幹が埋まった。靄は残るが白背景では気にならない。
掛けたい場合は --max-scale などを明示的に渡す。
"""
import argparse
import sys
import time

import numpy as np
from plyfile import PlyData, PlyElement
from scipy.ndimage import binary_closing, binary_dilation
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors


def log(msg):
    print(msg, flush=True)


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input")
    p.add_argument("output")
    p.add_argument("--sigma", type=float, default=3.0,
                   help="実体の範囲とみなす中央値からの標準偏差の倍数")
    p.add_argument("--min-samples", type=int, default=20,
                   help="DBSCAN の min_samples。eps もこの値から決める")
    p.add_argument("--min-cluster", type=int, default=5000,
                   help="芯として採用するクラスタの最小点数")
    p.add_argument("--cell", type=float, default=0.5,
                   help="footprint のグリッド解像度 (m)")
    # 形状フィルタは既定で掛けない。渡したものだけが効く
    p.add_argument("--max-scale", type=float, default=None,
                   help="ガウシアンの最長軸の上限 (m)")
    p.add_argument("--max-aniso", type=float, default=None,
                   help="最長軸 ÷ 最短軸 の上限。幹の表面も異方性が高いので注意")
    p.add_argument("--min-opacity", type=float, default=None,
                   help="不透明度の下限")
    return p.parse_args()


def finite_mask(vertices):
    """NaN や Inf を持つ点を落とす。

    学習の出力にはこれが混ざることがある。1 つでも NaN があると
    np.std がシーン全体で NaN を返し、以降の統計が全部壊れる。
    """
    columns = ["x", "y", "z", "scale_0", "scale_1", "scale_2", "opacity"]
    ok = np.ones(len(vertices), dtype=bool)
    for name in columns:
        ok &= np.isfinite(vertices[name])
    return ok


def crop_outliers(points, sigma):
    """遠方の巨大ゴミを落とす。KD-tree を無駄に広げないための前処理でもある"""
    med, dev = np.median(points, axis=0), points.std(axis=0)
    inside = np.all(
        (points >= med - dev * sigma) & (points <= med + dev * sigma), axis=1
    )
    return np.where(inside)[0]


def find_core(points, min_samples, min_cluster):
    """DBSCAN で、実体があると言えるクラスタだけを集める"""
    # eps はデータの実測密度から決める。min_samples 番目の近傍までの距離の
    # 中央値を使うと「min_samples 点が集まる程度の半径」になり、
    # 密度の違うシーンでも同じ振る舞いになる。
    rng = np.random.default_rng(0)
    sample = points[rng.choice(len(points), min(50_000, len(points)), replace=False)]
    distances, _ = (
        NearestNeighbors(n_neighbors=min_samples).fit(points).kneighbors(sample)
    )
    eps = float(np.median(distances[:, -1]))

    t = time.time()
    labels = DBSCAN(eps=eps, min_samples=min_samples, n_jobs=-1).fit_predict(points)
    unique, counts = np.unique(labels[labels >= 0], return_counts=True)
    big = unique[counts >= min_cluster]

    log(f"2. DBSCAN eps={eps:.3f} / {time.time() - t:.1f}s "
        f"→ 芯 {np.isin(labels, big).sum():,} 点 (クラスタ {len(big)}/{len(unique)})")
    return np.isin(labels, big)


def footprint_mask(points, core, cell):
    """芯の平面形状を求め、その中にある点を拾い直す"""
    # 森は水平に広く鉛直に薄いので、広がりが最小の軸を鉛直とみなす
    extent = core.max(axis=0) - core.min(axis=0)
    up = int(np.argmin(extent))
    flat = [a for a in (0, 1, 2) if a != up]
    log(f"3. 芯の広がり {np.round(extent, 1)} → 軸 {'xyz'[up]} を鉛直とみなす")

    origin = core[:, flat].min(axis=0)
    cells = np.floor((core[:, flat] - origin) / cell).astype(np.int64)
    shape = tuple(cells.max(axis=0) + 1)

    occupied = np.zeros(shape, dtype=bool)
    occupied[cells[:, 0], cells[:, 1]] = True
    before = occupied.sum()
    # 芯の内側の隙間を埋めてから 1 セルぶん広げる
    occupied = binary_closing(occupied, np.ones((3, 3), bool))
    occupied = binary_dilation(occupied, np.ones((3, 3), bool))
    log(f"   footprint {shape[0]}x{shape[1]} セル @{cell}m: "
        f"{before:,} → {occupied.sum():,} セル ({occupied.sum() * cell ** 2:,.0f} m2)")

    query = np.floor((points[:, flat] - origin) / cell).astype(np.int64)
    within = np.all((query >= 0) & (query < np.array(shape)), axis=1)
    mask = np.zeros(len(points), dtype=bool)
    mask[within] = occupied[query[within, 0], query[within, 1]]

    # 鉛直方向は芯の範囲に余白を足したところで抑える
    low, high = core[:, up].min(), core[:, up].max()
    margin = (high - low) * 0.1
    return mask & (points[:, up] >= low - margin) & (points[:, up] <= high + margin)


def shape_mask(vertices, max_scale, max_aniso, min_opacity):
    """指定された条件だけでガウシアンを絞る。何も渡されなければ全部残す"""
    keep = np.ones(len(vertices), dtype=bool)
    if max_scale is None and max_aniso is None and min_opacity is None:
        return keep

    # 3DGS の PLY は scale を log で持つ
    scales = np.exp(
        np.stack([vertices["scale_0"], vertices["scale_1"], vertices["scale_2"]], -1)
    )
    scales = np.sort(scales, axis=1)[:, ::-1]  # 長い順
    longest = scales[:, 0]

    if max_scale is not None:
        keep &= longest < max_scale
    if max_aniso is not None:
        keep &= longest / np.maximum(scales[:, 2], 1e-9) < max_aniso
    if min_opacity is not None:
        keep &= 1.0 / (1.0 + np.exp(-vertices["opacity"])) > min_opacity
    return keep


def main():
    args = parse_args()

    vertices = PlyData.read(args.input)["vertex"].data
    total = len(vertices)
    log(f"読み込み {total:,} 点")

    finite = np.where(finite_mask(vertices))[0]
    if len(finite) < total:
        log(f"0. NaN/Inf を落として {len(finite):,} 点 "
            f"({total - len(finite):,} 点除去)")
    if len(finite) == 0:
        log("有限な点が 1 つも無い")
        return 1

    points_all = np.stack(
        [vertices["x"], vertices["y"], vertices["z"]], axis=-1
    ).astype(np.float64)[finite]

    inside = crop_outliers(points_all, args.sigma)
    points = points_all[inside]      # 以降 points と kept は同じ並び
    kept = finite[inside]            # vertices への添字
    log(f"1. 箱で切って {len(points):,} 点 ({len(points) / total * 100:.1f}%)")

    core = find_core(points, args.min_samples, args.min_cluster)
    if not core.any():
        log("芯が見つからなかった。--min-cluster を下げてみてください")
        return 1

    mask = footprint_mask(points, points[core], args.cell)
    log(f"4. footprint 内を拾い直し {mask.sum():,} 点 "
        f"(芯だけなら {core.sum():,} 点なので {mask.sum() - core.sum():+,})")

    kept = kept[mask]
    mask = shape_mask(
        vertices[kept], args.max_scale, args.max_aniso, args.min_opacity
    )
    kept = kept[mask]
    if mask.all():
        log(f"5. 形状フィルタなし。{len(kept):,} 点 "
            f"({len(kept) / total * 100:.1f}% of 原データ)")
    else:
        log(f"5. 形と不透明度で絞って {len(kept):,} 点 "
            f"({len(kept) / total * 100:.1f}% of 原データ)")

    PlyData([PlyElement.describe(vertices[kept], "vertex")], text=False).write(
        args.output
    )
    log(f"書き出し {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
