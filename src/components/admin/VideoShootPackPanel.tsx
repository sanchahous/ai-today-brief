'use client';

import { useState } from 'react';
import type { VideoShootJob, VideoShootPack, VideoShootScene } from '@/lib/weekly-digest/video-shoot-pack';

const COPY_BTN =
  'min-h-11 rounded-xl border border-white/15 px-3 text-xs font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[.04]';

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={COPY_BTN} onClick={() => void copy()}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function JobCard({ job }: { job: VideoShootJob }) {
  return (
    <article className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-bold tracking-wide text-cyan-100/90 uppercase">
        {job.serviceName}
      </p>
      <p className="text-sm text-slate-300">{job.action}</p>
      <p className="text-xs text-slate-500">{job.serviceRule}</p>
      <p className="font-mono text-xs break-all text-slate-400">{job.outputRelPath}</p>
      {job.stillUrl ? (
        // Signed Visuals URL; admin already serves these outside next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={job.stillUrl} alt={job.stillTitle ?? 'Story illustration'} className="max-h-28 w-auto rounded-lg" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <CopyButton label={job.copyLabel} text={job.copyText} />
        <CopyButton label="Copy output path" text={job.outputRelPath} />
        <a
          href={job.serviceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-xs font-bold text-[#47e4d3] underline-offset-2 hover:underline"
        >
          Open {job.serviceName.split(' ')[0]}
        </a>
      </div>
      <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-2 text-xs whitespace-pre-wrap text-slate-300">
        {job.copyText}
      </pre>
    </article>
  );
}

function SceneCard({ scene }: { scene: VideoShootScene }) {
  return (
    <section
      className="grid gap-3 rounded-2xl border border-white/10 p-4"
      data-testid={`video-shoot-scene-${scene.fileIndex}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-base font-bold text-white">
          scene-{scene.fileIndex} · {scene.kind} · {scene.sceneId}
        </h4>
        <p className="text-xs text-slate-500">{Math.round(scene.durationSeconds)}s in script</p>
      </header>
      {scene.onScreenText ? (
        <p className="text-sm text-slate-400">On screen: {scene.onScreenText}</p>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-2">
        {scene.jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
}

export function VideoShootPackPanel({ pack }: { pack: VideoShootPack }) {
  if (pack.scenes.length === 0) {
    return (
      <p className="text-sm text-slate-400" data-testid="video-shoot-pack-empty">
        Generate the TV-news script above. This pack is derived from those scenes — there is no
        second copy in the video repo.
      </p>
    );
  }

  return (
    <div className="grid gap-4" data-testid="video-shoot-pack">
      <div className="grid gap-1 text-sm text-slate-400">
        <p>{pack.assembleNote}</p>
        <p>
          Drop living news clips in <code className="text-slate-300">{pack.dropBrollDir}</code>
          {' '}and presenter clips in <code className="text-slate-300">{pack.dropAvatarDir}</code>.
        </p>
      </div>
      {pack.blockers.length > 0 ? (
        <ul className="grid gap-1 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-xs text-amber-100">
          {pack.blockers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {pack.scenes.map((scene) => (
        <SceneCard key={scene.sceneId} scene={scene} />
      ))}
    </div>
  );
}
