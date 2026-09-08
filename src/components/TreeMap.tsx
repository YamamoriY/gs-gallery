"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// maplibre-gl v6 の ESM ビルドにデフォルトエクスポートは無いので名前で取る
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import type { RasterTileSource, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { SceneTrees } from "@/lib/trees";
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
  photo: {
    label: "航空写真",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  pale: {
    label: "淡色",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
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

/**
 * 林班・小班の境界。北海道オープンデータの森林計画資料を
 * scripts/pytools/compartments.py で GeoJSON にしたもの。
 * 無ければ切り替えボタン自体を出さない。
 */
const COMPARTMENTS = "compartments.geojson";

interface Props {
  entries: SceneTrees[];
  bounds: [[number, number], [number, number]];
  /** 一覧側で選ばれている株。地図の表示を合わせるだけに使う */
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function TreeMap({ entries, bounds, selected, onSelect }: Props) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const [basemap, setBasemap] = useState<BasemapKey>("photo");
  const [showCompartments, setShowCompartments] = useState(false);
  const [hasCompartments, setHasCompartments] = useState(false);

  // 地図の生成は一度だけ。以降はレイヤーとマーカーを差し替える
  useEffect(() => {
    if (!container.current || map.current) return;

    const m = new MapLibreMap({
      container: container.current,
      style: styleFor("photo"),
      bounds,
      fitBoundsOptions: { padding: 70, maxZoom: 18 },
      // 林内の細かい位置合わせをするので、既定より寄れるようにする
      maxZoom: 21,
    });
    // 林班の境界。航空写真が見えるように塗らず、線と番号だけ出す
    m.on("load", async () => {
      const url = assetUrl(COMPARTMENTS);
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (!res.ok) return;
      } catch {
        return;
      }
      if (m.getSource("compartments")) return;
      m.addSource("compartments", { type: "geojson", data: url });
      m.addLayer({
        id: "compartment-line",
        type: "line",
        source: "compartments",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#ffd24a",
          "line-width": 1.5,
          "line-opacity": 0.9,
        },
      });
      m.addLayer({
        id: "compartment-label",
        type: "symbol",
        source: "compartments",
        layout: {
          visibility: "none",
          "text-field": [
            "case",
            ["all", ["has", "compartment"], ["has", "subCompartment"]],
            ["concat", ["get", "compartment"], "-", ["get", "subCompartment"]],
            ["has", "compartment"],
            ["get", "compartment"],
            "",
          ],
          "text-size": 11,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#ffd24a",
          "text-halo-color": "rgba(0,0,0,0.75)",
          "text-halo-width": 1.4,
        },
      });
      setHasCompartments(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 林班の表示切替
  useEffect(() => {
    const m = map.current;
    if (!m || !hasCompartments) return;
    const visibility = showCompartments ? "visible" : "none";
    for (const id of ["compartment-line", "compartment-label"]) {
      if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visibility);
    }
  }, [showCompartments, hasCompartments]);

  // 背景地図の切り替え。ラスタのタイル URL を差し替えるだけで済ませる
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const source = m.getSource("base") as RasterTileSource | undefined;
    if (source?.setTiles) source.setTiles([BASEMAPS[basemap].tiles]);
  }, [basemap]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    for (const marker of markers.current.values()) marker.remove();
    markers.current.clear();

    for (const entry of entries) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "tree-pin";
      el.textContent = entry.scene.title;
      el.title =
        entry.trees
          .map((t) => `${t.id}: ${t.diameter ? `${t.diameter} cm` : "直径未測定"}`)
          .join(" / ") + " — 押すと 3D が開きます";
      // 押したらその株の点群を開く。現地で番号から 3D に飛べるようにする
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        router.push(`/scenes/${entry.scene.id}/`);
      });

      markers.current.set(
        entry.scene.id,
        new Marker({ element: el })
          .setLngLat([entry.longitude, entry.latitude])
          .addTo(m),
      );
    }
  }, [entries, router]);

  // 選択状態をマーカーに反映し、選ばれた木に寄る
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement().dataset.selected = String(id === selected);
    }
    const entry = entries.find((e) => e.scene.id === selected);
    if (entry && map.current) {
      map.current.easeTo({
        center: [entry.longitude, entry.latitude],
        zoom: Math.max(map.current.getZoom(), 19),
        duration: 600,
      });
    }
  }, [selected, entries]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      <div className="absolute left-3 top-3 flex overflow-hidden rounded border border-line bg-bark/95 text-xs backdrop-blur">
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

      {hasCompartments && (
        <button
          type="button"
          onClick={() => setShowCompartments((v) => !v)}
          className={
            "absolute left-3 top-12 rounded border px-3 py-1.5 text-xs backdrop-blur transition " +
            (showCompartments
              ? "border-amber-400/70 bg-amber-400/25 text-paper"
              : "border-line bg-bark/95 text-paper-dim hover:text-paper")
          }
        >
          林班界
        </button>
      )}
    </div>
  );
}
