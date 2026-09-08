import Link from "next/link";
import { formatCompartment } from "@/lib/plots";
import type { PlotWithScene } from "@/lib/plots";

/**
 * 標準地の一覧。
 *
 * 単木の表とは別に持つ。林分をまとめて撮ったスキャンは個体を指さないので、
 * 番号と直径ではなく林班番号と面積で示す。
 */
export function PlotTable({ rows }: { rows: PlotWithScene[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-paper-dim">
            <th scope="col" className="py-2 pr-4 font-normal">標準地</th>
            <th scope="col" className="py-2 pr-4 font-normal">林班</th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">面積</th>
            <th scope="col" className="py-2 pr-4 font-normal">形状</th>
            <th scope="col" className="py-2 font-normal">3D</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ plot, scene }) => (
            <tr
              key={plot.id}
              className="border-b border-line/60 align-baseline hover:bg-bark-soft"
            >
              <th scope="row" className="py-2.5 pr-4 text-left font-mono text-base font-semibold">
                {plot.id}
              </th>
              <td className="py-2.5 pr-4 text-paper-dim">
                {formatCompartment(plot)}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {plot.areaHectares !== null ? (
                  <span className="font-semibold">{plot.areaHectares} ha</span>
                ) : (
                  <span className="text-paper-dim">未登録</span>
                )}
              </td>
              <td className="py-2.5 pr-4 text-paper-dim">
                {plot.shape || "—"}
              </td>
              <td className="py-2.5">
                <Link
                  href={`/scenes/${scene.id}/`}
                  className="text-moss underline hover:text-paper"
                >
                  {scene.title}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
