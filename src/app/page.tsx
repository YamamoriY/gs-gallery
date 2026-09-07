import Link from "next/link";
import { TreeTable } from "@/components/TreeTable";
import { getScenes, formatBytes } from "@/lib/scenes";
import { getTreeRows, getScenesWithoutTrees, getTrees } from "@/lib/trees";

export default function Home() {
  const rows = getTreeRows();
  const scenes = getScenes();
  const orphans = getScenesWithoutTrees();
  const trees = getTrees();
  const measured = trees.filter((t) => t.diameter !== null);
  const totalBytes = scenes.reduce((a, s) => a + (s.converted?.bytes ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">立木一覧</h1>
        <p className="mt-2 max-w-2xl text-sm text-paper-dim">
          測定した木を 3D Gaussian Splatting で記録したものです。
          番号を選ぶとブラウザ上でその木の周りを歩き回れます。
          <Link href="/map/" className="ml-1 underline hover:text-paper">
            地図で見る
          </Link>
          こともできます。
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-sm text-paper-dim">
          <p>まだ公開できる立木がありません。</p>
          <p className="mt-2">
            <code className="text-paper">npm run convert</code> で PLY を SOG
            に変換し、<code className="text-paper">npm run scan</code>{" "}
            でカタログを更新してください。
          </p>
        </div>
      ) : (
        <>
          <TreeTable rows={rows} />

          <p className="mt-4 text-xs text-paper-dim">
            {trees.length} 本 / {scenes.length} シーン。
            うち直径を測ってあるのは {measured.length} 本。
            配信データは合計 {formatBytes(totalBytes)}。
          </p>
        </>
      )}

      {orphans.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-sm font-semibold">立木が結び付いていないシーン</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {orphans.map((s) => (
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
        </section>
      )}
    </main>
  );
}
