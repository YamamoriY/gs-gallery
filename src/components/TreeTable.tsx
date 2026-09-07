"use client";

import { useState } from "react";
import Link from "next/link";
import { directionsUrl, formatLatLng } from "@/lib/trees";
import type { TreeRow } from "@/lib/trees";

type SortKey = "id" | "diameter" | "height" | "volume";

/**
 * 立木の一覧。
 *
 * 点数や容量といった変換の内部事情ではなく、現地で木を選ぶときに要る情報
 * (番号・直径・位置) を並べる。伐採対象を決めるのに数値で並べ替えたいので
 * 表にしてある。
 *
 * 樹高と材積はまだ正確に測れていない。空の列を出しても邪魔なだけなので、
 * 1 本でも値が入っている場合だけ列を出す。
 */
export function TreeTable({ rows }: { rows: TreeRow[] }) {
  const [sort, setSort] = useState<SortKey>("id");
  const [desc, setDesc] = useState(false);

  const hasHeight = rows.some((r) => r.height !== null);
  const hasVolume = rows.some((r) => r.volume !== null);

  const value = (r: TreeRow, key: SortKey) =>
    key === "diameter" ? r.diameter
    : key === "height" ? r.height
    : key === "volume" ? r.volume
    : null;

  const sorted = [...rows].sort((a, b) => {
    if (sort === "id") {
      const d = a.ids[0].localeCompare(b.ids[0], undefined, { numeric: true });
      return desc ? -d : d;
    }
    // 未測定は並び順によらず末尾に置く
    const av = value(a, sort);
    const bv = value(b, sort);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return desc ? bv - av : av - bv;
  });

  const toggle = (key: SortKey) => {
    if (key === sort) setDesc(!desc);
    else {
      setSort(key);
      // 数値は大きい順から見たいことが多い
      setDesc(key !== "id");
    }
  };

  const Head = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      scope="col"
      className={`py-2 pr-4 font-normal ${right ? "text-right" : "text-left"}`}
    >
      <button type="button" onClick={() => toggle(k)} className="hover:text-paper">
        {label}
        {k === sort ? (desc ? " ▼" : " ▲") : ""}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-paper-dim">
            <Head k="id" label="立木番号" />
            <Head k="diameter" label="胸高直径" right />
            {hasHeight && <Head k="height" label="樹高" right />}
            {hasVolume && <Head k="volume" label="材積" right />}
            <th scope="col" className="py-2 pr-4 font-normal">樹種</th>
            <th scope="col" className="py-2 pr-4 font-normal">位置</th>
            <th scope="col" className="py-2 font-normal">3D</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.key}
              className="border-b border-line/60 align-baseline hover:bg-bark-soft"
            >
              <th
                scope="row"
                className="py-2.5 pr-4 text-left font-mono text-base font-semibold"
              >
                {r.ids.join("・")}
              </th>

              <td className="py-2.5 pr-4 text-right tabular-nums">
                {r.diameter ? (
                  <span className="font-semibold">{r.diameter} cm</span>
                ) : (
                  <span className="text-paper-dim">未測定</span>
                )}
              </td>

              {hasHeight && (
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {r.height ? `${r.height} m` : <span className="text-paper-dim">—</span>}
                </td>
              )}
              {hasVolume && (
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {r.volume ? `${r.volume} m³` : <span className="text-paper-dim">—</span>}
                </td>
              )}

              <td className="py-2.5 pr-4 text-paper-dim">{r.species}</td>

              <td className="py-2.5 pr-4">
                <span className="font-mono text-xs text-paper-dim">
                  {formatLatLng(r.latitude, r.longitude)}
                </span>
                {r.positionEstimated && (
                  <span className="ml-2 text-xs text-amber-700">推定</span>
                )}
                <a
                  href={directionsUrl(r.latitude, r.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 text-xs underline hover:text-paper"
                >
                  経路案内
                </a>
              </td>

              <td className="py-2.5">
                <Link
                  href={`/scenes/${r.scene.id}/`}
                  className="text-moss underline hover:text-paper"
                >
                  {r.scene.title}
                </Link>
                {r.siblingIds.length > 0 && (
                  <span className="ml-2 text-xs text-paper-dim">
                    {r.siblingIds.join("・")} と同じ株
                  </span>
                )}
                {r.scene.warning && (
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
