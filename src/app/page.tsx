import { SceneCard } from "@/components/SceneCard";
import { getScenes, formatBytes, formatCount } from "@/lib/scenes";

export default function Home() {
  const scenes = getScenes();
  const totalGaussians = scenes.reduce(
    (a, s) => a + (s.converted?.gaussians ?? 0),
    0,
  );
  const totalBytes = scenes.reduce((a, s) => a + (s.converted?.bytes ?? 0), 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">スキャン一覧</h1>
        <p className="mt-2 max-w-2xl text-sm text-paper-dim">
          撮影した森林を 3D Gaussian Splatting で再構成したものです。
          カードを選ぶとブラウザ上で自由に歩き回れます。
        </p>
        {scenes.length > 0 && (
          <p className="mt-4 text-xs text-paper-dim">
            {scenes.length} シーン / 合計 {formatCount(totalGaussians)} ガウシアン
            / 配信サイズ {formatBytes(totalBytes)}
          </p>
        )}
      </section>

      {scenes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-sm text-paper-dim">
          <p>まだ公開できるシーンがありません。</p>
          <p className="mt-2">
            <code className="text-paper">npm run convert</code> で PLY を SOG
            に変換し、<code className="text-paper">npm run scan</code>{" "}
            でカタログを更新してください。
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene) => (
            <li key={scene.id}>
              <SceneCard scene={scene} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
