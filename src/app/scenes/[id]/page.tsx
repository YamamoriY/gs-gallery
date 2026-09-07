import Link from "next/link";
import { notFound } from "next/navigation";
import { SceneViewer } from "@/components/SceneViewer";
import {
  assetUrl,
  formatBytes,
  formatCount,
  getScene,
  getScenes,
  sceneSizeMetres,
  formatSize,
} from "@/lib/scenes";
import {
  directionsUrl,
  formatDms,
  formatLatLng,
  getSceneTreesFor,
} from "@/lib/trees";

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

  // 萌芽更新した株は 1 回の撮影に複数の幹が入っている
  const placed = getSceneTreesFor(scene);
  const sizeMetres = sceneSizeMetres(scene);

  const facts: [string, string][] = [
    ["撮影日", scene.capturedAt ?? "—"],
    ["学習日", scene.trainedAt],
    [
      "元データ",
      `${formatCount(scene.source.gaussians)} ガウシアン / ` +
        `${formatBytes(scene.source.bytes)} / SH${scene.source.shDegree ?? "?"}`,
    ],
    [
      "配信データ",
      scene.converted
        ? `${scene.converted.gaussians ? `${formatCount(scene.converted.gaussians)} ガウシアン / ` : ""}` +
          formatBytes(scene.converted.bytes)
        : "—",
    ],
    [
      "この空間の大きさ",
      sizeMetres ? `約 ${formatSize(sizeMetres)}` : "スケール未計測",
    ],
    ["元の写真", scene.imageCount !== null ? `${scene.imageCount} 枚` : "—"],
    ["プロジェクト", scene.sourceProject ?? "—"],
  ];

  if (placed) {
    facts.splice(2, 0, [
      "立木番号",
      placed.trees.map((t) => t.id).join("、"),
    ]);
    facts.splice(3, 0, [
      "胸高直径",
      placed.trees
        .map((t) => (t.diameter ? `${t.id}: ${t.diameter} cm` : `${t.id}: 未測定`))
        .join(" / "),
    ]);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/" className="text-sm text-paper-dim hover:text-paper">
        ← 立木一覧へ
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{scene.title}</h1>
        {scene.description && (
          <p className="mt-2 max-w-2xl text-sm text-paper-dim">
            {scene.description}
          </p>
        )}
        {scene.warning && (
          <p className="mt-3 max-w-2xl rounded border border-amber-600/50 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {scene.warning}
          </p>
        )}
      </div>

      <SceneViewer
        scene={scene}
        className="aspect-video w-full rounded-lg border border-line bg-white"
      />

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-xs text-paper-dim">
        <span>ドラッグで視点回転、ホイールでズーム。WASD で移動できます。</span>
        {sizeMetres ? (
          <span>
            この空間は約 <span className="text-paper">{formatSize(sizeMetres)}</span>
            。写り込んでいるヘリポート（一辺 50 cm）を物差しにして測っています
          </span>
        ) : (
          <span>スケール未計測（ヘリポートが写っていないか、検出できていません）</span>
        )}
      </div>

      {placed ? (
        <div className="mt-6 rounded-lg border border-moss/30 bg-moss/5 px-4 py-3">
          <div className="text-sm text-paper">現地の位置</div>
          <ul className="mt-2 space-y-1.5">
            {placed.trees.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-4 text-xs">
                <span className="w-10 font-mono text-sm text-paper">{t.id}</span>
                <span className="text-paper-dim">
                  {t.diameter ? `直径 ${t.diameter} cm` : "直径未測定"}
                </span>
                <span className="font-mono text-moss">
                  {formatLatLng(t.latitude, t.longitude)}
                </span>
                <span className="font-mono text-paper-dim">
                  {formatDms(t.latitude, t.longitude)}
                </span>
                <a
                  className="underline hover:text-paper"
                  href={directionsUrl(t.latitude, t.longitude)}
                  target="_blank"
                  rel="noreferrer"
                >
                  経路案内
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs">
            <Link className="underline hover:text-paper" href="/map/">
              地図で見る
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-xs text-amber-700">
          このシーンにはまだ立木が結び付いていません。
        </p>
      )}

      <dl className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="border-t border-line pt-2">
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
