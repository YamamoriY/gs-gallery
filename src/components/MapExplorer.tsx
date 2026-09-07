"use client";

import { useState } from "react";
import Link from "next/link";
import { SurveyMap } from "./SurveyMap";
import { directionsUrl, formatLatLng } from "@/lib/points";
import type { PointWithScenes, SurveySource } from "@/lib/points";
import type { Scene } from "@/lib/types";

interface Props {
  points: PointWithScenes[];
  bounds: [[number, number], [number, number]];
  unplaced: Scene[];
  source: SurveySource;
}

export function MapExplorer({ points, bounds, unplaced, source }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const placed = points.filter((p) => p.scenes.length).length;

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col lg:flex-row">
      <div className="h-1/2 w-full lg:h-full lg:w-2/3">
        <SurveyMap
          points={points}
          bounds={bounds}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <aside className="flex h-1/2 w-full flex-col overflow-y-auto border-t border-white/10 lg:h-full lg:w-1/3 lg:border-l lg:border-t-0">
        <div className="border-b border-white/10 px-5 py-4">
          <h1 className="text-base font-semibold">測定地点</h1>
          <p className="mt-1 text-xs text-paper-dim">
            {source.name}（{source.author}）から取得した {points.length} 地点。
            うち {placed} 地点にシーンが結び付いています。
          </p>
        </div>

        <ul className="divide-y divide-white/10">
          {points.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p.id === selected ? null : p.id)}
                className={
                  "w-full px-5 py-3 text-left transition " +
                  (p.id === selected ? "bg-moss/15" : "hover:bg-white/5")
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-sm text-paper">{p.id}</span>
                  <span className="text-xs text-paper-dim">{p.species}</span>
                </div>
                <div className="mt-1 font-mono text-xs text-paper-dim">
                  {formatLatLng(p)}
                </div>

                <dl className="mt-1 flex gap-4 text-xs text-paper-dim">
                  {p.diameter != null && (
                    <div>
                      <dt className="inline">直径 </dt>
                      <dd className="inline text-paper">{p.diameter} cm</dd>
                    </div>
                  )}
                  {p.height != null && (
                    <div>
                      <dt className="inline">樹高 </dt>
                      <dd className="inline text-paper">{p.height} m</dd>
                    </div>
                  )}
                </dl>

                {p.scenes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.scenes.map((s) => (
                      <Link
                        key={s.id}
                        href={`/scenes/${s.id}/`}
                        className="rounded border border-moss/40 bg-moss/10 px-2 py-0.5 text-xs text-moss hover:bg-moss/25"
                      >
                        {s.title}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-300/70">
                    シーン未割り当て
                  </p>
                )}

                {p.note && (
                  <p className="mt-2 text-xs leading-relaxed text-paper-dim">
                    {p.note}
                  </p>
                )}

                <a
                  href={directionsUrl(p)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 inline-block text-xs text-paper-dim underline hover:text-paper"
                >
                  この地点へ経路案内
                </a>
              </button>
            </li>
          ))}
        </ul>

        {unplaced.length > 0 && (
          <div className="border-t border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold">地点が未設定のシーン</h2>
            <p className="mt-1 text-xs leading-relaxed text-paper-dim">
              <code className="text-paper">data/scenes.overrides.json</code> に{" "}
              <code className="text-paper">{'"pointId": "p01"'}</code>{" "}
              のように書くと、その地点に結び付きます。萌芽更新した株のように
              1 地点に複数のシーンが対応する場合は、同じ id を複数のシーンに書きます。
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {unplaced.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/scenes/${s.id}/`}
                    className="rounded border border-white/15 px-2 py-0.5 font-mono text-xs text-paper-dim hover:border-white/40 hover:text-paper"
                  >
                    {s.id}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
