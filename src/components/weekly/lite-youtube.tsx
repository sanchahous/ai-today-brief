'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { PlayIcon } from '@/components/icons';
import type { Lang } from '@/lib/site';

export function LiteYouTube({
  videoId,
  thumbnailUrl,
  title,
  lang,
  priority = false,
}: {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  lang: Lang;
  priority?: boolean;
}) {
  const [active, setActive] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (active) frameRef.current?.focus();
  }, [active]);

  const embedUrl =
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    `?autoplay=1&rel=0&cc_load_policy=1&cc_lang_pref=${lang}&hl=${lang}`;

  return (
    <div className="border-border bg-surface rounded-card relative aspect-video overflow-hidden border">
      {active ? (
        <iframe
          ref={frameRef}
          src={embedUrl}
          title={title}
          tabIndex={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          data-digest-event="video_play"
          onClick={() => setActive(true)}
          className="group absolute inset-0 block h-full w-full overflow-hidden text-left"
          aria-label={lang === 'uk' ? `Відтворити відео: ${title}` : `Play video: ${title}`}
        >
          <Image
            src={thumbnailUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 960px"
            className="object-cover transition duration-300 group-hover:scale-[1.015]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10"
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="bg-accent text-on-accent grid h-16 w-16 place-items-center rounded-full shadow-2xl transition group-hover:scale-105 sm:h-20 sm:w-20">
              <PlayIcon size={34} />
            </span>
          </span>
          <span className="absolute right-4 bottom-4 left-4 text-sm font-semibold text-white drop-shadow sm:text-base">
            {title}
          </span>
        </button>
      )}
    </div>
  );
}
