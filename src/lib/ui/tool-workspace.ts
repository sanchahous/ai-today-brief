import type { ToolOutputState } from '@/components/tools/tool-workspace-output';

export type ToolCopyPhase = 'idle' | 'copied' | 'export-error';

export function deriveToolOutputState(
  hasResult: boolean,
  copyPhase: ToolCopyPhase,
): ToolOutputState {
  if (!hasResult) return 'draft';
  if (copyPhase === 'copied') return 'copied';
  if (copyPhase === 'export-error') return 'export-error';
  return 'ready';
}

export async function copyToolOutput(
  text: string,
  setPhase: (phase: ToolCopyPhase) => void,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    setPhase('copied');
    window.setTimeout(() => setPhase('idle'), 1800);
  } catch {
    setPhase('export-error');
  }
}
