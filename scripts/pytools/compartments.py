"""
森林計画資料の shapefile から、対象地の周りの林班・小班だけを GeoJSON にする。

  python compartments.py 入力.shp 出力.geojson --centre 42.1064,140.6817 --radius 2500

北海道オープンデータポータルの「森林計画資料 (一般民有林)」を想定している。
座標系は EPSG:2459 (平面直角座標系 XI 系) なので EPSG:4326 に直す。

地域全体だと数十 MB あって GitHub Pages に載せられないので、対象地の周りだけ
切り出す。属性も林班・小班番号など地図に出すものだけ残す。
"""
import argparse
import json
import math
import sys

import shapefile          # pyshp
from pyproj import Transformer

# 森林簿の項目名は自治体ごとに揺れるので、拾えたものを使う
FIELD_ALIASES = {
    "compartment": ("林班", "RINPAN", "rinpan", "林班番号"),
    "subCompartment": ("小班", "SHOHAN", "shohan", "小班番号"),
    "species": ("樹種", "JUSHU", "樹種名"),
    "age": ("林齢", "RINREI", "林齢級"),
    "area": ("面積", "MENSEKI", "面積ha"),
}


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", help="shapefile (.shp)")
    p.add_argument("output", help="書き出す GeoJSON")
    p.add_argument("--centre", required=True, help="切り出しの中心 緯度,経度")
    p.add_argument("--radius", type=float, default=2500.0,
                   help="切り出す半径 (m)")
    p.add_argument("--source-crs", default="EPSG:2459",
                   help="入力の座標系")
    p.add_argument("--precision", type=int, default=6,
                   help="書き出す座標の小数桁。減らすとファイルが小さくなる")
    return p.parse_args()


def pick_fields(field_names):
    """森林簿の項目名を、こちらで使う名前に対応づける"""
    found = {}
    for key, aliases in FIELD_ALIASES.items():
        for i, name in enumerate(field_names):
            if any(a in name for a in aliases):
                found[key] = i
                break
    return found


def main():
    args = parse_args()
    lat, lon = (float(x) for x in args.centre.split(","))

    to_wgs = Transformer.from_crs(args.source_crs, "EPSG:4326", always_xy=True)
    to_src = Transformer.from_crs("EPSG:4326", args.source_crs, always_xy=True)
    cx, cy = to_src.transform(lon, lat)

    reader = shapefile.Reader(args.input, encoding="shift_jis")
    names = [f[0] for f in reader.fields[1:]]
    fields = pick_fields(names)
    print(f"項目 {len(names)} 個: {', '.join(names[:12])}"
          f"{' ...' if len(names) > 12 else ''}", file=sys.stderr)
    print(f"使う項目: {fields}", file=sys.stderr)

    features = []
    for rec in reader.iterShapeRecords():
        shape = rec.shape
        if not shape.points:
            continue
        # bbox で粗く弾いてから中心距離で判定する
        x0, y0, x1, y1 = shape.bbox
        if x1 < cx - args.radius or x0 > cx + args.radius:
            continue
        if y1 < cy - args.radius or y0 > cy + args.radius:
            continue
        if math.dist(((x0 + x1) / 2, (y0 + y1) / 2), (cx, cy)) > args.radius * 1.5:
            continue

        parts = list(shape.parts) + [len(shape.points)]
        rings = []
        for i in range(len(parts) - 1):
            ring = [
                [round(v, args.precision) for v in to_wgs.transform(x, y)]
                for x, y in shape.points[parts[i]:parts[i + 1]]
            ]
            if len(ring) >= 4:
                rings.append(ring)
        if not rings:
            continue

        props = {}
        for key, idx in fields.items():
            value = rec.record[idx]
            if value not in (None, ""):
                props[key] = value.strip() if isinstance(value, str) else value

        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "Polygon", "coordinates": rings},
        })

    doc = {"type": "FeatureCollection", "features": features}
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))

    import os
    print(f"{len(features)} 区画を書き出しました -> {args.output} "
          f"({os.path.getsize(args.output) / 1024:.0f} KB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
