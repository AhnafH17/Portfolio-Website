export type DeskQuality = 'full' | 'light';

export const DESK_BUDGETS = {
  full: { dpr: 2, fps: 60, environment: 256 },
  // Phones read the monitor UIs at their holds; below ~1.6x the text goes soft.
  light: { dpr: 1.6, fps: 30, environment: 64 },
} satisfies Record<DeskQuality, { dpr: number; fps: number; environment: number }>;

export function deskDevicePreferences() {
  const hints = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    static: Boolean(hints.connection?.saveData || (hints.deviceMemory && hints.deviceMemory <= 2)),
    light: Boolean(
      matchMedia('(pointer: coarse)').matches ||
        (hints.hardwareConcurrency && hints.hardwareConcurrency <= 6) ||
        (hints.deviceMemory && hints.deviceMemory <= 4)
    ),
  };
}
