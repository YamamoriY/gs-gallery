import Link from "next/link";
import { assetUrl, formatBytes, formatCount } from "@/lib/scenes";
import type { Scene } from "@/lib/types";

export function SceneCard({ scene }: { scene: Scene }) {
  return (
    <Link
      href={`/scenes/${scene.id}/`}
      className="group block overflow-hidden rounded-lg border border-white/10 bg-bark-soft transition hover:border-moss/60"
    >
      <div className="aspect-video overflow-hidden bg-black/40">
        {scene.thumbnail ? (
          // 静的書き出しなので next/image ではなく素の img を使う
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(scene.thumbnail)}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          // カード画像はまだ入れていない。npm run thumbs で
          // 撮影写真から作れるようにしてある
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-moss-dim/25 to-bark">
            <span className="font-mono text-xs tracking-widest text-moss/70">
              {scene.id}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate font-medium">{scene.title}</h2>
          <span className="shrink-0 text-xs text-paper-dim">
            {scene.capturedAt ?? scene.trainedAt}
          </span>
        </div>

        {scene.description && (
          <p className="line-clamp-2 text-sm text-paper-dim">
            {scene.description}
          </p>
        )}

        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-paper-dim">
          <div>
            <dt className="inline">点数 </dt>
            <dd className="inline text-paper">
              {formatCount(scene.source.gaussians)}
            </dd>
          </div>
          {scene.converted && (
            <div>
              <dt className="inline">配信 </dt>
              <dd className="inline text-paper">
                {formatBytes(scene.converted.bytes)}
              </dd>
            </div>
          )}
          {scene.imageCount !== null && (
            <div>
              <dt className="inline">写真 </dt>
              <dd className="inline text-paper">{scene.imageCount} 枚</dd>
            </div>
          )}
        </dl>

        {scene.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {scene.tags.map((tag) => (
              <li
                key={tag}
                className="rounded bg-moss-dim/30 px-1.5 py-0.5 text-[11px] text-moss"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}
