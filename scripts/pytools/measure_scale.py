"""
3DGS に写っているヘリポート (一辺 50cm の橙色の正方形) を探して、
このシーンの 1 ユニットが何メートルかを出す。

目印は橙色の「枠」で中央が白い。点がまばらだと枠が途切れて別々のかたまりに
割れ、細長い断片として拾われる (20260902_693 で 0.71x1.78 になった)。
クラスタリングの距離 --eps はそれが繋がる程度に広く取る必要がある。

  python measure_scale.py 入力.ply

結果は JSON で標準出力に出す。見つからなければ found: false。

再構成のスケールは撮影ごとに任意なので、シーンごとに測り直す必要がある。
大きさの分かっている物が写っていれば、それを物差しに使える。
"""
import argparse
import json
import sys

import numpy as np
from plyfile import PlyData
from sklearn.cluster import DBSCAN

# 3DGS の PLY は色を球面調和の 0 次で持つ
SH_C0 = 0.28209479177387814


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input")
    p.add_argument("--side", type=float, default=0.50,
                   help="目印の一辺の実寸 (m)")
    p.add_argument("--min-points", type=int, default=100,
                   help="目印とみなすのに必要な点数")
    p.add_argument("--eps", type=float, default=0.20,
                   help="クラスタリングの距離。枠が割れない程度に広く取る")
    p.add_argument("--min-squareness", type=float, default=0.75,
                   help="短辺÷長辺がこれ以上なら正方形とみなす")
    p.add_argument("--max-flatness", type=float, default=0.35,
                   help="厚み÷幅がこれ以下なら板とみなす")
    return p.parse_args()


def orange_mask(vertices):
    """橙色っぽいガウシアンを拾う。森の中では緑と茶しか無いのでよく浮く"""
    rgb = np.clip(
        0.5 + SH_C0 * np.stack(
            [vertices["f_dc_0"], vertices["f_dc_1"], vertices["f_dc_2"]], -1
        ),
        0, 1,
    )
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    high, low = rgb.max(1), rgb.min(1)
    saturation = np.where(high > 0, (high - low) / np.maximum(high, 1e-9), 0)
    return (r > g) & (g >= b) & (saturation > 0.40) & (high > 0.30)


def min_area_rect(plane):
    """面内の点群を囲む最小の長方形。板の一辺を測るのに使う"""
    best = None
    for degrees in np.arange(0, 90, 0.5):
        t = np.radians(degrees)
        rotated = plane @ np.array(
            [[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]]
        )
        w, h = rotated.max(0) - rotated.min(0)
        if best is None or w * h < best[0]:
            best = (w * h, w, h)
    return best[1], best[2]


def main():
    args = parse_args()
    vertices = PlyData.read(args.input)["vertex"].data
    points = np.stack(
        [vertices["x"], vertices["y"], vertices["z"]], -1
    ).astype(np.float64)

    mask = orange_mask(vertices)
    if mask.sum() < args.min_points:
        print(json.dumps({"found": False,
                          "reason": f"橙色が {int(mask.sum())} 点しかない"}))
        return 0

    candidates = points[mask]
    labels = DBSCAN(eps=args.eps, min_samples=15, n_jobs=-1).fit_predict(candidates)
    unique, counts = np.unique(labels[labels >= 0], return_counts=True)
    if len(counts) == 0:
        print(json.dumps({"found": False, "reason": "まとまりが無い"}))
        return 0

    best = None
    for i in np.argsort(counts)[::-1][:8]:
        cluster = candidates[labels == unique[i]]
        if len(cluster) < args.min_points:
            continue
        centre = cluster.mean(0)
        _, singular, basis = np.linalg.svd(cluster - centre, full_matrices=False)
        singular = singular / np.sqrt(len(cluster))
        flatness = singular[2] / singular[1]
        w, h = min_area_rect((cluster - centre) @ basis[:2].T)
        squareness = min(w, h) / max(w, h)
        # 正方形で、かつ薄いものほど目印らしい
        score = squareness * (1 - min(flatness, 1))
        if best is None or score > best["score"]:
            best = {"score": score, "points": int(counts[i]),
                    "w": float(w), "h": float(h), "flatness": float(flatness),
                    "squareness": float(squareness),
                    "centre": [float(x) for x in centre]}

    if best is None:
        print(json.dumps({"found": False, "reason": "十分な大きさのまとまりが無い"}))
        return 0

    found = (best["squareness"] >= args.min_squareness
             and best["flatness"] <= args.max_flatness)
    side = (best["w"] + best["h"]) / 2
    print(json.dumps({
        "found": bool(found),
        "reason": None if found else "形が正方形の板になっていない",
        "points": best["points"],
        "size": [round(best["w"], 3), round(best["h"], 3)],
        "squareness": round(best["squareness"], 3),
        "flatness": round(best["flatness"], 3),
        "centre": [round(x, 3) for x in best["centre"]],
        "metresPerUnit": round(args.side / side, 4),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
