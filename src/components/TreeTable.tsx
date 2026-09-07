"use client";

import { useState } from "react";
import Link from "next/link";
import { directionsUrl, formatLatLng } from "@/lib/trees";
import type { TreeWithScene } from "@/lib/trees";

type SortKey = "id" | "diameter";

/**
 * 立木の一覧。
 *
 * 点数や容量といった変換の内部事情ではなく、現地で木を選ぶときに要る情報
 * (番号・直径・位置) を並べる。伐採対象を決めるのに直径で並べ替えたいので
 * 表にしてある。
 */
export function TreeTable({ rows }: { rows: TreeWithScene[] }) {
  const [sort, setSort] = useState<SortKey>("id");
  const [desc, setDesc] = useState(false);

  const sorted = [...rows].sort((a, b) => {
    const d =
      sort === "diameter"
        ? // 未測定は常に末尾へ
          (a.tree.diameter ?? -1) - (b.tree.diameter ?? -1)
        : a.tree.id.localeCompare(b.tree.id, undefined, { numeric: true });
    return desc ? -d : d;
  });

  const toggle = (key: SortKey) => {
    if (key === sort) setDesc(!desc);
    else {
      setSort(key);
      setDesc(key === "diameter");
    }
  };

  const arrow = (key: SortKey) =>
    key === sort ? (desc ? " ▼" : " ▲") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-paper-dim">
            <th scope="col" className="py-2 pr-4 font-normal">
              <button
                type="button"
                onClick={() => toggle("id")}
                className="hover:text-paper"
              >
                立木番号{arrow("id")}
              </button>
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              <button
                type="button"
                onClick={() => toggle("diameter")}
                className="hover:text-paper"
              >
                胸高直径{arrow("diameter")}
              </button>
            </th>
            <th scope="col" className="py-2 pr-4 font-normal">樹種</th>
            <th scope="col" className="py-2 pr-4 font-normal">位置</th>
            <th scope="col" className="py-2 font-normal">3D</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ tree, scene, siblings }) => (
            <tr
              key={tree.id}
              className="border-b border-line/60 align-baseline hover:bg-bark-soft"
            >
              <th scope="row" className="py-2.5 pr-4 text-left font-mono text-base font-semibold">
                {tree.id}
              </th>

              <td className="py-2.5 pr-4 text-right tabular-nums">
                {tree.diameter ? (
                  <span className="font-semibold">{tree.diameter} cm</span>
                ) : (
                  <span className="text-paper-dim">未測定</span>
                )}
              </td>

              <td className="py-2.5 pr-4 text-paper-dim">{tree.species}</td>

              <td className="py-2.5 pr-4">
                <span className="font-mono text-xs text-paper-dim">
                  {formatLatLng(tree.latitude, tree.longitude)}
                </span>
                {tree.positionEstimated && (
                  <span className="ml-2 text-xs text-amber-700">推定</span>
                )}
                <a
                  href={directionsUrl(tree.latitude, tree.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 text-xs underline hover:text-paper"
                >
                  経路案内
                </a>
              </td>

              <td className="py-2.5">
                <Link
                  href={`/scenes/${scene.id}/`}
                  className="text-moss underline hover:text-paper"
                >
                  {scene.title}
                </Link>
                {siblings.length > 0 && (
                  <span className="ml-2 text-xs text-paper-dim">
                    {siblings.map((s) => s.id).join("・")} と同じ株
                  </span>
                )}
                {scene.warning && (
                  <span className="ml-2 rounded border border-amber-600/50 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                    データに問題あり
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
