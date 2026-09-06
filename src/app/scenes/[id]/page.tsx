import Link from "next/link";
import { notFound } from "next/navigation";
import { SceneViewer } from "@/components/SceneViewer";
import {
  assetUrl,
  formatBytes,
  formatCount,
  getScene,
  getScenes,
} from "@/lib/scenes";

// 静的書き出しなので、どのシーンのページを作るかをここで列挙する
export function generateStaticParams() {
  return getScenes().map((scene) => ({ id: scene.id }));
}

export default async function ScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scene = getScene(id);
  if (!scene) notFound();

  const facts: [string, string][] = [
    ["撮影日", scene.capturedAt ?? "—"],
    ["学習日", scene.trainedAt],
    ["ガウシアン数", `${formatCount(scene.source.gaussians)} (元データ)`],
    ["元 PLY", `${formatBytes(scene.source.bytes)} / SH${scene.source.shDegree ?? "?"}`],
    ["配信データ", scene.converted ? formatBytes(scene.converted.bytes) : "—"],
    ["元の写真", scene.imageCount !== null ? `${scene.imageCount} 枚` : "—"],
    ["プロジェクト", scene.sourceProject ?? "—"],
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/" className="text-sm text-paper-dim hover:text-paper">
        ← 一覧へ
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{scene.title}</h1>
        {scene.description && (
          <p className="mt-2 max-w-2xl text-sm text-paper-dim">
            {scene.description}
          </p>
        )}
      </div>

      <SceneViewer
        scene={scene}
        className="aspect-video w-full rounded-lg border border-white/10 bg-black"
      />

      <p className="mt-3 text-xs text-paper-dim">
        ドラッグで視点回転、ホイールでズーム。WASD で移動できます。
      </p>

      <dl className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="border-t border-white/10 pt-2">
            <dt className="text-xs text-paper-dim">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      {scene.converted && (
        <p className="mt-8 text-xs text-paper-dim">
          <a
            className="underline hover:text-paper"
            href={assetUrl(scene.converted.file)}
            download
          >
            SOG をダウンロード
          </a>
        </p>
      )}
    </main>
  );
}
