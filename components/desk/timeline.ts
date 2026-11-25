/* The desk's timing without three.js: the scroll beats DeskHero pins against
   and the power-on that follows the preloader. Kept apart from beats.ts so
   the page's first bundle doesn't carry three.js. */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const ease = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

export const HOLDS = [
  [0.2, 0.3],
  [0.38, 0.48],
  [0.56, 0.69],
] as const;
export const FIRST_WORK = (HOLDS[0][0] + HOLDS[0][1]) / 2;
/** The beats above are timed against this much scroll, in screens. */
export const BEAT_SCREENS = (phone: boolean) => (phone ? 4.4 : 4.8);
/** About starts rising as the camera leaves the last monitor, so the
 *  pull-back and its entrance happen together (beat units). */
export const ABOUT_RISE = HOLDS[2][1] + 0.012;
/** The pin ends one screen after About starts rising: About then fills it. */
export const tourScreens = (phone: boolean) => ABOUT_RISE * BEAT_SCREENS(phone) + 1;
/** Pin progress (0-1) to beat progress, and back. */
export const toBeat = (pin: number, phone: boolean) => (pin * tourScreens(phone)) / BEAT_SCREENS(phone);
export const toPin = (beat: number, phone: boolean) => (beat * BEAT_SCREENS(phone)) / tourScreens(phone);
/** Where About starts rising, in pin progress. */
export const aboutOverlapStart = (phone: boolean) => toPin(ABOUT_RISE, phone);

/* The handover, in seconds from the moment the preloader's bars start to
   come away (Preloader sets `handover.start`; DeskModel and the preloader's
   line drawing both read the clock below, so they stay in step):
   - 0-0.8   the bars pull apart over the dark room; the drawing's lines sit
             exactly on the desk (same camera) and brighten;
   - 0.5-1.4 the room lights come up under the lines while they dissolve
             part by part, desk first; the drawn LED strip gives way to the
             real LED sweep at the same pixels; the screens power on left,
             centre, right where their outlines were. */
export const INTRO_END = 1.65;

/** Shared between the preloader and the desk: when the handover started
 *  (performance.now()), and whether the preloader carried the name into
 *  the hero heading (DeskHero then leaves the heading alone). */
export const handover: { start: number | null; name: boolean } = { start: null, name: false };

/** The scene's power-on at `seconds` into the handover (null: not revealed
 *  yet, so the room is dark). */
export function introAt(seconds: number | null) {
  const s = seconds ?? 0;
  const ramp = (start: number, length: number) => clamp01((s - start) / length);
  const screens = [0, 1, 2].map((i) => {
    const r = ramp(0.84 + i * 0.15, 0.26);
    // A short stutter as each panel catches, then a clean ramp.
    const flicker = r > 0.06 && r < 0.42 && Math.sin(s * 96 + i * 2.3) < -0.15 ? 0.3 : 1;
    return ease(r) * flicker;
  });
  return {
    sweep: seconds === null ? 0 : ease(ramp(0.5, 0.6)),
    screens,
    room: 0.05 + 0.95 * ease(ramp(0.55, 0.85)),
    done: s >= INTRO_END,
  };
}

/** The drawing's side of the handover: how bright its lines are (0-1 on
 *  top of the settled level), and each part's opacity, parts dissolving in
 *  drawing order (desk first) as the surfaces light up under them. */
export function outlineAt(seconds: number, part: number) {
  return {
    bright: ease((seconds - 0.25) / 0.3),
    opacity: 1 - ease((seconds - 0.62 - part * 0.065) / 0.42),
  };
}
