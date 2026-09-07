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
import { directionsUrl, formatLatLng, getPoint } from "@/lib/points";

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

  const point = getPoint(scene.pointId);
  // 萌芽更新した株は幹ごとに番号を振って撮っているので、
  // 同じ地点にぶら下がる他のシーンを出しておくと現地で迷わない
  const siblings = point
    ? point.scenes.filter((s) => s.id !== scene.id)
    : [];

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
    ["元の写真", scene.imageCount !== null ? `${scene.imageCount} 枚` : "—"],
    ["プロジェクト", scene.sourceProject ?? "—"],
  ];

  if (point) {
    facts.splice(2, 0, ["測定地点", `${point.id} / ${formatLatLng(point)}`]);
    if (point.diameter != null) {
      facts.splice(3, 0, ["胸高直径", `${point.diameter} cm`]);
    }
    if (point.height != null) {
      facts.splice(point.diameter != null ? 4 : 3, 0, ["樹高", `${point.height} m`]);
    }
  }

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

      {point ? (
        <div className="mt-6 rounded-lg border border-moss/30 bg-moss/5 px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-sm text-paper">現地の位置</span>
            <span className="font-mono text-sm text-moss">
              {formatLatLng(point)}
            </span>
            {siblings.length > 0 && (
              <span className="text-xs text-paper-dim">
                同じ株の別の幹:{" "}
                {siblings.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && "、"}
                    <Link className="underline hover:text-paper" href={`/scenes/${s.id}/`}>
                      {s.title}
                    </Link>
                  </span>
                ))}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <a
              className="underline hover:text-paper"
              href={directionsUrl(point)}
              target="_blank"
              rel="noreferrer"
            >
              経路案内を開く
            </a>
            <Link className="underline hover:text-paper" href="/map/">
              地図で見る
            </Link>
          </div>
          {point.note && (
            <p className="mt-2 text-xs leading-relaxed text-paper-dim">
              {point.note}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-6 text-xs text-amber-300/70">
          このシーンにはまだ測定地点が結び付いていません。
        </p>
      )}

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
