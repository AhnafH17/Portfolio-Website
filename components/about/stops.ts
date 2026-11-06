/* The About section's story: where the camera stops, and what's written
   there. Words only from the site's existing About copy and the principles on
   the laptop's screen.

   node:  the model node to frame (null = the whole island)
   frame: how much room around it (higher = further back)
   lift:  how far above centre it sits, as a share of the view, leaving room
          for the panel
   dir:   where the camera looks from */
export interface AboutStop {
  id: string;
  node: string | null;
  frame: number;
  lift: number;
  dir: [number, number, number];
  kicker?: string;
  title: string;
  lines: string[];
  chips?: string[];
}

// A sweep from the desk down the left, across to the right and up to the
// core. The platforms' labels face +Z and their tops catch the light from the
// right, so every view comes from the front right.
export const ABOUT_STOPS: AboutStop[] = [
  { id: 'intro', node: 'BASE_Static', frame: 1.6, lift: 0.05, dir: [6, 5.2, 7],
    kicker: 'About me', title: 'Lead by role, architect by craft.', lines: [] },
  { id: 'who', node: 'PLT_Desk', frame: 1.2, lift: 0.16, dir: [1.5, 3.4, 8],
    title: 'Ahnaf Hussain', lines: ['Head of Web Development at AurixLab', 'I design scalable systems and lead teams building modern web products.'] },
  { id: 'systems', node: 'PLT_Architecture', frame: 1.75, lift: 0.1, dir: [2, 5.2, 7],
    title: 'Systems Architecture', lines: ['Architecture-first: define the system before writing code.'] },
  { id: 'team', node: 'PLT_Deployment', frame: 1.75, lift: 0.1, dir: [2.6, 5.2, 6.6],
    title: 'Team Leadership', lines: ['Lead by doing, not delegating.'] },
  { id: 'frontend', node: 'PLT_Development', frame: 2, lift: 0.17, dir: [3.6, 4, 7],
    title: 'Frontend Standards', lines: ['Set frontend standards used on every project.'],
    chips: ['WordPress', 'Next.js', 'TypeScript', 'Shopify', 'Python', 'SEO'] },
  { id: 'core', node: 'CUBE_Core', frame: 3.2, lift: 0.12, dir: [6, 5.2, 7],
    title: 'Raise the floor, not just the ceiling.', lines: [] },
];

export const SIGN_SIZE = (narrow: boolean) => (narrow ? { w: 1000, h: 620 } : { w: 1400, h: 560 });

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function wrap(c: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > max && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** One panel: dark glass, an accent hairline, the words. */
export function drawSign(c: CanvasRenderingContext2D, w: number, h: number, stop: AboutStop, o: { accent: string; accentLight: string; narrow: boolean }) {
  const pad = o.narrow ? 56 : 68;
  const inner = w - pad * 2;
  const body = o.narrow ? 40 : 36;
  const small = o.narrow ? 34 : 28;   // the kicker and chips
  const chip = small + 24;
  c.clearRect(0, 0, w, h);

  // Measure first, so the panel hugs its text and sits at the canvas bottom.
  let titleSize = o.narrow ? 74 : 76;
  c.font = `${titleSize}px 'Greater Theory', sans-serif`;
  let titleLines = wrap(c, stop.title.toUpperCase(), inner);
  while (titleLines.some((l) => c.measureText(l).width > inner) && titleSize > 30) {
    titleSize -= 2;
    c.font = `${titleSize}px 'Greater Theory', sans-serif`;
    titleLines = wrap(c, stop.title.toUpperCase(), inner);
  }
  c.font = `400 ${body}px 'DM Sans', sans-serif`;
  const bodyLines = stop.lines.flatMap((l) => wrap(c, l, inner));
  const kickerH = stop.kicker ? 58 : 0;
  const titleH = titleLines.length * titleSize * 1.08;
  const bodyH = bodyLines.length * body * 1.42 + (bodyLines.length ? 20 : 0);
  const chipH = stop.chips ? (o.narrow ? 170 : 84) : 0;
  const panelH = Math.min(h - 8, pad * 1.5 + kickerH + titleH + bodyH + chipH);
  const top = h - panelH - 4;

  roundRect(c, 3, top, w - 6, panelH, 18);
  c.fillStyle = 'rgba(7,9,13,0.93)';
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = o.accent;
  c.fillRect(pad, top, 150, 5);

  let y = top + pad * 0.75;
  c.textBaseline = 'top';
  if (stop.kicker) {
    c.font = `600 ${small}px 'DM Sans', sans-serif`;
    c.fillStyle = o.accentLight;
    c.letterSpacing = '8px';
    c.fillText(stop.kicker.toUpperCase(), pad, y);
    c.letterSpacing = '0px';
    y += kickerH;
  }
  c.font = `${titleSize}px 'Greater Theory', sans-serif`;
  titleLines.forEach((l, i) => {
    c.fillStyle = i === 0 && stop.id === 'intro' ? o.accent : '#eef1f3';
    c.fillText(l, pad, y);
    y += titleSize * 1.08;
  });
  if (bodyLines.length) y += 20;
  c.font = `400 ${body}px 'DM Sans', sans-serif`;
  c.fillStyle = '#c2cad0';
  bodyLines.forEach((l) => { c.fillText(l, pad, y); y += body * 1.42; });
  if (stop.chips) {
    y += 22;
    let x = pad;
    c.font = `600 ${small}px 'DM Sans', sans-serif`;
    for (const label of stop.chips) {
      const cw = c.measureText(label).width + 44;
      if (x + cw > w - pad) { x = pad; y += chip + 12; }
      roundRect(c, x, y, cw, chip, chip / 2);
      c.strokeStyle = o.accentLight;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#eef1f3';
      c.fillText(label, x + 22, y + 12);
      x += cw + 14;
    }
  }
}
