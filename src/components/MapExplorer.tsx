"use client";

import { useState } from "react";
import Link from "next/link";
import { TreeMap } from "./TreeMap";
import { directionsUrl, formatDms, formatLatLng } from "@/lib/trees";
import type { SceneTrees, TreeSource } from "@/lib/trees";
import type { Scene } from "@/lib/types";

interface Props {
  entries: SceneTrees[];
  bounds: [[number, number], [number, number]];
  without: Scene[];
  source: TreeSource;
}

export function MapExplorer({ entries, bounds, without, source }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const treeCount = entries.reduce((a, e) => a + e.trees.length, 0);

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col lg:flex-row">
      <div className="h-1/2 w-full lg:h-full lg:w-2/3">
        <TreeMap
          entries={entries}
          bounds={bounds}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <aside className="flex h-1/2 w-full flex-col overflow-y-auto border-t border-line lg:h-full lg:w-1/3 lg:border-l lg:border-t-0">
        <div className="border-b border-line px-5 py-4">
          <h1 className="text-base font-semibold">立木の位置</h1>
          <p className="mt-1 text-xs leading-relaxed text-paper-dim">
            {entries.length} 株 / {treeCount} 本。位置は{" "}
            <a
              className="underline hover:text-paper"
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.name}
            </a>
            （{source.author}）の実測値。
          </p>
        </div>

        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.scene.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSelected(e.scene.id === selected ? null : e.scene.id)
                }
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setSelected(e.scene.id === selected ? null : e.scene.id);
                  }
                }}
                className={
                  "cursor-pointer px-5 py-3 transition " +
                  (e.scene.id === selected ? "bg-moss/15" : "hover:bg-bark-soft")
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-paper">
                    {e.scene.title}
                  </span>
                  <Link
                    href={`/scenes/${e.scene.id}/`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-xs text-moss underline hover:text-paper"
                  >
                    3D で見る
                  </Link>
                </div>

                {/* 幹ごとに番号と直径。萌芽更新した株は複数行になる */}
                <ul className="mt-2 space-y-1">
                  {e.trees.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-baseline gap-3 text-xs"
                    >
                      <span className="w-10 font-mono text-paper">{t.id}</span>
                      <span className="text-paper-dim">
                        {t.diameter ? `直径 ${t.diameter} cm` : "直径未測定"}
                      </span>
                      <a
                        href={directionsUrl(t.latitude, t.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        className="ml-auto text-paper-dim underline hover:text-paper"
                      >
                        経路案内
                      </a>
                    </li>
                  ))}
                </ul>

                <div className="mt-2 font-mono text-xs text-paper-dim">
                  {formatLatLng(e.latitude, e.longitude)}
                </div>
                <div className="font-mono text-xs text-paper-dim">
                  {formatDms(e.latitude, e.longitude)}
                </div>

                {e.estimated && (
                  <p className="mt-2 text-xs leading-relaxed text-amber-700">
                    位置は実測ではなく推定です。
                    {e.trees.find((t) => t.positionEstimated)?.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {without.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            <h2 className="text-sm font-semibold">立木が未設定のシーン</h2>
            <p className="mt-1 text-xs leading-relaxed text-paper-dim">
              立木番号は成果物のファイル名から決まります。番号でない名前の
              シーンは、<code className="text-paper">data/scenes.overrides.json</code>{" "}
              に <code className="text-paper">{'"trees": ["684"]'}</code>{" "}
              と書けば結び付きます。
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {without.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/scenes/${s.id}/`}
                    className="rounded border border-line px-2 py-0.5 font-mono text-xs text-paper-dim hover:border-paper-dim hover:text-paper"
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
