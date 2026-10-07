/* Where the 3D device's screen is on the page, published every frame the
   device renders (components/device/deviceModel.ts, screenTracker) so the
   showcase -> laptop handoff can land a glass pane exactly on it. */
export const deviceScreen = {
  canvas: null as HTMLCanvasElement | null,
  /** Corners in canvas CSS px: top-left, top-right, bottom-right, bottom-left. */
  quad: new Float32Array(8),
  /** The laptop's Return key, in canvas CSS px (the laptop -> About
      handoff pops it off the keyboard), and its width on screen. */
  key: new Float32Array(3),
  /** performance.now() of the last publish. */
  at: 0,
};
