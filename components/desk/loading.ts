export type DeskLoad =
  | { phase: 'starting' | 'rendering' | 'ready' | 'fallback' }
  | { phase: 'downloading'; fraction: number | null };

export type ReportDeskLoad = (load: DeskLoad) => void;
