"use client";

import { useEffect, useRef, useState } from "react";
// maplibre-gl v5 の ESM ビルドにデフォルトエクスポートは無いので名前で取る
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import type { RasterTileSource, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PointWithScenes } from "@/lib/points";
import { assetUrl } from "@/lib/scenes";

// MapLibre は既定でワーカーの URL を自分のチャンクからの相対で作るが、
// バンドルするとそこにワーカーは無く 404 になり、タイルが一切読まれない。
// scripts/vendor-maplibre.mjs が public/maplibre/ に置いたものを指す。
setWorkerUrl(assetUrl("maplibre/maplibre-gl-worker.mjs"));

/**
 * 背景地図は国土地理院のタイル。API キーが要らず、林地では OSM より
 * 地形と林道が正確に入っている。航空写真も同じ座標系で重ねられるので、
 * 現地に入る前の見当付けに使える。
 * https://maps.gsi.go.jp/development/ichiran.html
 */
const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>';

const BASEMAPS = {
  pale: {
    label: "淡色",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
  },
  photo: {
    label: "航空写真",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

function styleFor(key: BasemapKey): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: [BASEMAPS[key].tiles],
        tileSize: 256,
        maxzoom: 18,
        attribution: GSI_ATTRIBUTION,
      },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

interface Props {
  points: PointWithScenes[];
  bounds: [[number, number], [number, number]];
  /** 選ばれた地点。一覧側と同期させる */
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function SurveyMap({ points, bounds, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const [basemap, setBasemap] = useState<BasemapKey>("photo");

  // 地図の生成は一度だけ。以降はレイヤーとマーカーを差し替える
  useEffect(() => {
    if (!container.current || map.current) return;

    const m = new MapLibreMap({
      container: container.current,
      style: styleFor("photo"),
      bounds,
      fitBoundsOptions: { padding: 80, maxZoom: 18 },
      // 林内の細かい位置合わせをするので、既定より寄れるようにする
      maxZoom: 21,
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new ScaleControl({ maxWidth: 120, unit: "metric" }));
    m.on("click", () => onSelect(null));
    map.current = m;

    // 生成時点ではコンテナの寸法が確定していないことがあり、
    // そのままだとキャンバスが実際より小さいまま描かれる。
    // 画面幅で縦並びと横並びが入れ替わるレイアウトでもあるので、
    // 一度きりの resize() ではなくコンテナを監視し続ける。
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
    // bounds と onSelect は初期化時の値だけ使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 背景地図の切り替え。ラスタのタイル URL を差し替えるだけで済ませる
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const source = m.getSource("base") as RasterTileSource | undefined;
    if (source?.setTiles) source.setTiles([BASEMAPS[basemap].tiles]);
  }, [basemap]);

  // マーカー
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    for (const marker of markers.current.values()) marker.remove();
    markers.current.clear();

    for (const p of points) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "survey-pin";
      el.dataset.state = p.scenes.length ? "placed" : "empty";
      el.textContent = p.id.replace(/^p0?/, "");
      el.title = p.scenes.length
        ? p.scenes.map((s) => s.title).join(", ")
        : "シーン未割り当て";
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(p.id);
      });

      markers.current.set(
        p.id,
        new Marker({ element: el })
          .setLngLat([p.longitude, p.latitude])
          .addTo(m),
      );
    }
  }, [points, onSelect]);

  // 選択状態をマーカーに反映し、選ばれた地点に寄る
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement().dataset.selected = String(id === selected);
    }
    const p = points.find((x) => x.id === selected);
    if (p && map.current) {
      map.current.easeTo({
        center: [p.longitude, p.latitude],
        zoom: Math.max(map.current.getZoom(), 19),
        duration: 600,
      });
    }
  }, [selected, points]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      <div className="absolute left-3 top-3 flex overflow-hidden rounded border border-white/20 bg-bark/90 text-xs backdrop-blur">
        {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setBasemap(key)}
            className={
              "px-3 py-1.5 transition " +
              (basemap === key
                ? "bg-moss/30 text-paper"
                : "text-paper-dim hover:text-paper")
            }
          >
            {BASEMAPS[key].label}
          </button>
        ))}
      </div>
    </div>
  );
}
