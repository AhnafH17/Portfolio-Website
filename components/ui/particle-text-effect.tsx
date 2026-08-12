"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"

/* ────────────────────────────────────────────────────────────
   Tuning
   ──────────────────────────────────────────────────────────── */
const FRAME_MS   = 1000 / 60  // reference frame; all speeds are "per 60fps frame"
const MAX_DT     = 2.5        // clamp so one long frame can't explode the sim
const RESUME_MS  = 250        // frame gap above this = tab was backgrounded
const CLOSE      = 110        // start easing off this far from the target
const SETTLED_R2 = 34 * 34    // squared radius that counts as "arrived"
const FORMED_PCT = 0.88       // fraction of particles needed to call a word formed
const TAU        = Math.PI * 2

// Colour quantisation for draw batching: 5 bits/channel. Turns ~4000
// fillStyle string parses per frame into ~20.
const CBITS   = 5
const NBUCKET = 1 << (CBITS * 3)

const LIVE = 0, DYING = 1, DORMANT = 2

export interface Cloud {
  xs: Float32Array
  ys: Float32Array
  n: number
  /** Optional per-point RGB (3 bytes/point). Text clouds omit it and take the accent. */
  cs?: Uint8Array
}

/* ────────────────────────────────────────────────────────────
   Text sampling
   ──────────────────────────────────────────────────────────── */

/**
 * Rasterise `word` into a canvas only as large as the text itself and read
 * back the opaque pixels as a point cloud in main-canvas coordinates.
 *
 * The old version rasterised onto a full-viewport canvas and read all of it
 * back — ~8MB per word on a 1080p screen. Cropping to the glyph box cuts that
 * by 10-15x, which is the difference between a visible hitch and not.
 */
function sampleCloud(
  off: HTMLCanvasElement,
  word: string,
  cw: number,
  ch: number,
  fontSize: number,
  fontFamily: string,
  budget: number,
): Cloud {
  const ctx = off.getContext("2d", { willReadFrequently: true })!
  const font = `${fontSize}px ${fontFamily}`

  ctx.font = font
  const textW = Math.ceil(ctx.measureText(word).width) + 16
  const offW = Math.max(2, Math.min(cw, textW))
  const offH = Math.max(2, Math.min(ch, Math.ceil(fontSize * 1.8)))

  // Assigning width/height also clears the canvas and resets context state
  off.width = offW
  off.height = offH
  ctx.font = font
  ctx.fillStyle = "#fff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(word, offW / 2, offH / 2)

  const data = ctx.getImageData(0, 0, offW, offH).data
  const dx = (cw - offW) / 2
  const dy = (ch - offH) / 2

  // Sample on a 2D grid so density is uniform (the old stride walked the flat
  // buffer, which sampled densely down and sparsely across).
  const step = Math.max(2, Math.round(fontSize / 34))

  const pts: number[] = []
  for (let y = 0; y < offH; y += step) {
    const row = y * offW
    for (let x = 0; x < offW; x += step) {
      if (data[(row + x) * 4 + 3] > 128) pts.push(dx + x, dy + y)
    }
  }

  // Shuffle pairs, then keep the first `budget` — particles then assemble the
  // word out of the cloud rather than sweeping across it, and the count stays
  // within the device's budget without thinning any one region.
  const total = pts.length / 2
  for (let i = total - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const a = i * 2, b = j * 2
    const px = pts[a], py = pts[a + 1]
    pts[a] = pts[b]; pts[a + 1] = pts[b + 1]
    pts[b] = px;     pts[b + 1] = py
  }

  const n = Math.min(total, budget)
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    xs[i] = pts[i * 2]
    ys[i] = pts[i * 2 + 1]
  }
  return { xs, ys, n }
}

export interface ImageCloudOptions {
  img: CanvasImageSource & { width: number; height: number }
  /** Destination box, in main-canvas coordinates. */
  left: number; top: number; width: number; height: number
  /** Corner radii, matching the frame's border-radius. */
  radii: [number, number, number, number]
  /** CSS object-position Y as 0..1 (0.3 == "center 30%"). */
  focusY: number
  /** Extra transform scale applied about the box centre. */
  zoom: number
  accent: { r: number; g: number; b: number }
  budget: number
}

/**
 * Sample a photo into a duotone point cloud that lands exactly on top of the
 * real <img>.
 *
 * Duotone rather than true colour is deliberate on two counts: it stays
 * coherent with the randomised accent palette, and — because the whole ramp is
 * one-dimensional — every point collapses into a few dozen draw buckets. True
 * colour would spray points across thousands of buckets and defeat the batched
 * renderer entirely.
 */
export function sampleImageCloud(o: ImageCloudOptions): Cloud {
  const W = Math.max(1, Math.round(o.width))
  const H = Math.max(1, Math.round(o.height))
  const c = document.createElement("canvas")
  c.width = W; c.height = H
  const cx = c.getContext("2d", { willReadFrequently: true })!

  // Arch mask (the frame is overflow:hidden with a big top radius)
  cx.beginPath()
  if (typeof cx.roundRect === "function") cx.roundRect(0, 0, W, H, o.radii)
  else cx.rect(0, 0, W, H)
  cx.clip()

  // Replicate object-fit:cover + object-position + the element's transform,
  // so the particles resolve onto the photo instead of near it.
  const iw = o.img.width, ih = o.img.height
  const s = Math.max(W / iw, H / ih)
  const dw = iw * s, dh = ih * s
  cx.save()
  cx.translate(W / 2, H / 2); cx.scale(o.zoom, o.zoom); cx.translate(-W / 2, -H / 2)
  cx.drawImage(o.img, (W - dw) * 0.5, (H - dh) * o.focusY, dw, dh)
  cx.restore()

  /* The frame's ::after bottom-fade and ::before vignette, at ~80% of their
     CSS weight. These are not decoration here: the source photo has a warm,
     mid-bright backdrop that a luminance duotone would otherwise render as
     brightly as the subject. The vignette is what isolates the face. Backing
     off slightly keeps some particles on the arch edge for the silhouette. */
  const fade = cx.createLinearGradient(0, H, 0, H * 0.7)
  fade.addColorStop(0, "rgba(8,6,3,0.82)")
  fade.addColorStop(1, "rgba(8,6,3,0)")
  cx.fillStyle = fade
  cx.fillRect(0, 0, W, H)

  const vig = cx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.62)
  vig.addColorStop(0.55, "rgba(10,8,4,0)")
  vig.addColorStop(0.78, "rgba(10,8,4,0.44)")
  vig.addColorStop(1, "rgba(10,8,4,0.72)")
  cx.fillStyle = vig
  cx.fillRect(0, 0, W, H)

  const data = cx.getImageData(0, 0, W, H).data
  const lumAt = (x: number, y: number) => {
    const i = (y * W + x) * 4
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
  }

  // Oversample ~1.4x, then weight and truncate down to budget
  const step = Math.max(1, Math.round(Math.sqrt((W * H) / (o.budget * 1.4))))
  const pts: number[] = []   // x, y, luminance
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const l = lumAt(x, y)
      if (l < 0.04) continue               // black on black — never worth a particle
      /* Mild edge bias: enough to sharpen glasses, lapels and the jaw, but
         not so much that flat mid-tones (most of the face) get starved and
         the portrait reads as noise instead of a person. */
      const lx = lumAt(Math.min(x + step, W - 1), y)
      const ly = lumAt(x, Math.min(y + step, H - 1))
      const edge = Math.min(1, (Math.abs(l - lx) + Math.abs(l - ly)) * 4)
      if (Math.random() > 0.55 + 0.45 * edge) continue
      pts.push(x, y, l)
    }
  }

  const total = pts.length / 3
  for (let i = total - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const a = i * 3, b = j * 3
    for (let k = 0; k < 3; k++) { const t = pts[a + k]; pts[a + k] = pts[b + k]; pts[b + k] = t }
  }

  const n = Math.min(total, o.budget)
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  const cs = new Uint8Array(n * 3)

  const { r: ar, g: ag, b: ab } = o.accent
  const sr = ar * 0.14, sg = ag * 0.14, sb = ab * 0.14              // tinted shadow
  const hr = ar + (255 - ar) * 0.78                                  // near-white highlight
  const hg = ag + (255 - ag) * 0.78
  const hb = ab + (255 - ab) * 0.78

  for (let i = 0; i < n; i++) {
    xs[i] = o.left + pts[i * 3]
    ys[i] = o.top + pts[i * 3 + 1]
    /* Levels stretch then an S-curve. A plain gamma just lifts everything
       uniformly and the portrait goes flat; spreading the mid-tones is what
       separates the face from the suit and the backdrop. */
    let t = (pts[i * 3 + 2] - 0.08) / 0.74
    t = t < 0 ? 0 : t > 1 ? 1 : t
    t = t * t * (3 - 2 * t)
    const j = i * 3
    if (t < 0.5) {
      const k = t / 0.5
      cs[j]     = sr + (ar - sr) * k
      cs[j + 1] = sg + (ag - sg) * k
      cs[j + 2] = sb + (ab - sb) * k
    } else {
      const k = (t - 0.5) / 0.5
      cs[j]     = ar + (hr - ar) * k
      cs[j + 1] = ag + (hg - ag) * k
      cs[j + 2] = ab + (hb - ab) * k
    }
  }
  return { xs, ys, n, cs }
}

// Reads the active palette's accent triplet at runtime
function accentRGB(): { r: number; g: number; b: number } {
  if (typeof window === "undefined") return { r: 204, g: 24, b: 44 }
  const t = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-rgb").trim().split(",").map((n) => parseInt(n, 10))
  return { r: t[0] || 204, g: t[1] || 24, b: t[2] || 44 }
}

export interface ParticleTextHandle {
  nextWord: (word: string) => void
  /** Retarget the pool onto an arbitrary cloud (e.g. a sampled photo).
   *  Stops word cycling; `onFormed` fires once the cloud has assembled. */
  showPoints: (cloud: Cloud, onFormed?: () => void) => void
  killAll: () => void
}

export interface ParticleTextEffectProps {
  words?: string[]
  autoAdvance?: boolean
  /** Pacing target per word. Each word is held ~55% of this *after* it has
   *  visibly formed, and is force-advanced at 1.9x it in the worst case. */
  intervalMs?: number
  onWordCycle?: (index: number, word: string) => void
  onCycleComplete?: () => void
  fontSize?: number
  fontFamily?: string
  /** Extra pool capacity to allocate up front, for clouds handed in later via
   *  showPoints() that are denser than any of the words. */
  reserve?: number
}

export const ParticleTextEffect = forwardRef<ParticleTextHandle, ParticleTextEffectProps>(
  function ParticleTextEffect(
    {
      words = ["HELLO"],
      autoAdvance = true,
      intervalMs = 2800,
      onWordCycle,
      onCycleComplete,
      fontSize = 110,
      fontFamily = "Arial Black, Arial",
      reserve = 0,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef    = useRef<number>(0)
    const apiRef    = useRef<ParticleTextHandle>({
      nextWord: () => {}, showPoints: () => {}, killAll: () => {},
    })

    useImperativeHandle(ref, () => ({
      nextWord:   (w: string) => apiRef.current.nextWord(w),
      showPoints: (c: Cloud, cb?: () => void) => apiRef.current.showPoints(c, cb),
      killAll:    () => apiRef.current.killAll(),
    }))

    // Callbacks live in refs so the sim never has to be torn down and rebuilt
    const cbRef = useRef({ onWordCycle, onCycleComplete })
    cbRef.current = { onWordCycle, onCycleComplete }

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      let cancelled = false

      const boot = () => {
        if (cancelled || !canvasRef.current) return

        const cw = canvas.width  = Math.round(canvas.offsetWidth  || window.innerWidth)
        const ch = canvas.height = Math.round(canvas.offsetHeight || window.innerHeight)

        // alpha:false lets the compositor skip per-pixel blending of a
        // full-screen canvas — a real win on mobile GPUs. The preloader paints
        // its ambient glow above the canvas so nothing is lost visually.
        const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!
        ctx.fillStyle = "#080603"
        ctx.fillRect(0, 0, cw, ch)

        /* ── fit every word inside the canvas ──────────────────────────
           A word wider than the viewport would have its outer letters
           clipped off-screen, so scale the type down until the longest one
           fits. One size for all words keeps the sequence visually stable. */
        const measure = document.createElement("canvas").getContext("2d")!
        let size = fontSize
        measure.font = `${size}px ${fontFamily}`
        const widest = words.reduce((m, w) => Math.max(m, measure.measureText(w).width), 1)
        const limit = cw * 0.86
        if (widest > limit) size = Math.max(18, Math.floor(size * (limit / widest)))

        // Particle budget scaled to the device — a phone can't push 4000
        const budget = cw < 700 ? 1500 : cw < 1400 ? 2800 : 3800

        /* ── pre-sample every word up front ───────────────────────────
           Doing this once means changing words later is pure array
           assignment: no rasterising, no getImageData, no mid-animation hitch. */
        const off = document.createElement("canvas")
        const clouds = words.map((w) => sampleCloud(off, w, cw, ch, size, fontFamily, budget))
        const cap = Math.max(clouds.reduce((m, c) => Math.max(m, c.n), 0), reserve)
        if (cap === 0) return

        /* ── particle pool (struct-of-arrays) ─────────────────────────
           Typed arrays instead of objects: no per-particle property lookups,
           no GC churn. The pool is fixed — particles are recycled, never
           removed, so a later/longer word can never be starved of them
           (the old code spliced dead particles out of the array). */
        const px = new Float32Array(cap), py = new Float32Array(cap)
        const vx = new Float32Array(cap), vy = new Float32Array(cap)
        const tx = new Float32Array(cap), ty = new Float32Array(cap)
        const spd = new Float32Array(cap), frc = new Float32Array(cap)
        const rate = new Float32Array(cap), wt = new Float32Array(cap)
        const sr = new Float32Array(cap), sg = new Float32Array(cap), sb = new Float32Array(cap)
        const tr = new Float32Array(cap), tg = new Float32Array(cap), tb = new Float32Array(cap)
        const state = new Uint8Array(cap)

        for (let i = 0; i < cap; i++) {
          px[i] = Math.random() * cw
          py[i] = Math.random() * ch
          spd[i] = 14 + Math.random() * 9        // px per 60fps frame
          frc[i] = spd[i] * 0.16
          rate[i] = 0.015 + Math.random() * 0.025
          state[i] = DORMANT                      // nothing draws before word 1
        }

        const captureColor = (i: number) => {
          const w = wt[i]
          sr[i] += (tr[i] - sr[i]) * w
          sg[i] += (tg[i] - sg[i]) * w
          sb[i] += (tb[i] - sb[i]) * w
          wt[i] = 0
        }

        const kill = (i: number) => {
          if (state[i] !== LIVE) return
          const a = Math.random() * TAU
          const mag = (cw + ch) / 2
          tx[i] = cw / 2 + Math.cos(a) * mag
          ty[i] = ch / 2 + Math.sin(a) * mag
          captureColor(i)
          tr[i] = tg[i] = tb[i] = 0
          state[i] = DYING
        }

        let first = true
        const showCloud = (cloud: Cloud) => {
          const accent = accentRGB()
          const cs = cloud.cs
          const n = Math.min(cloud.n, cap)
          for (let i = 0; i < n; i++) {
            captureColor(i)
            if (cs) {
              const j = i * 3
              tr[i] = cs[j]; tg[i] = cs[j + 1]; tb[i] = cs[j + 2]
            } else {
              tr[i] = accent.r; tg[i] = accent.g; tb[i] = accent.b
            }
            tx[i] = cloud.xs[i]
            ty[i] = cloud.ys[i]
            // Recycled particles drop in near their new target so the word
            // morphs in place instead of streaking back from the edge.
            if (!first && state[i] !== LIVE) {
              const a = Math.random() * TAU
              const r = 40 + Math.random() * 70
              px[i] = cloud.xs[i] + Math.cos(a) * r
              py[i] = cloud.ys[i] + Math.sin(a) * r
              vx[i] = 0; vy[i] = 0
            }
            state[i] = LIVE
          }
          for (let i = n; i < cap; i++) kill(i)
          first = false
        }

        /* ── draw batching ─────────────────────────────────────────── */
        const buckets: (number[] | undefined)[] = new Array(NBUCKET)
        const bucketStr: (string | undefined)[] = new Array(NBUCKET)
        const activeKeys: number[] = []

        /* ── word state machine ────────────────────────────────────── */
        const holdMs = intervalMs * 0.55   // time held *after* the word forms
        const maxMs  = intervalMs * 1.9    // hard ceiling so we never stall
        let wordIndex = 0
        let wordStart = performance.now()
        let formedAt: number | null = null
        let finished = false
        let last = wordStart
        // Set once showPoints() takes over — word cycling stops for good.
        let manual = false
        let pendingFormed: (() => void) | null = null

        showCloud(clouds[0])

        const animate = (now: number) => {
          rafRef.current = requestAnimationFrame(animate)

          let elapsed = now - last
          last = now
          if (elapsed > RESUME_MS) {
            // Tab was backgrounded: don't let the pacing clock fast-forward
            // through words the user never saw.
            const gap = elapsed - FRAME_MS
            wordStart += gap
            if (formedAt !== null) formedAt += gap
            elapsed = FRAME_MS
          }
          const dt = Math.min(elapsed / FRAME_MS, MAX_DT)

          // Motion trail
          ctx.fillStyle = "rgba(8,6,3,0.18)"
          ctx.fillRect(0, 0, cw, ch)

          for (let i = 0; i < activeKeys.length; i++) buckets[activeKeys[i]]!.length = 0
          activeKeys.length = 0

          let live = 0, formed = 0

          for (let i = 0; i < cap; i++) {
            const st = state[i]
            if (st === DORMANT) continue

            const dx = tx[i] - px[i]
            const dy = ty[i] - py[i]
            const d2 = dx * dx + dy * dy

            if (st === LIVE) {
              live++
              if (d2 < SETTLED_R2) formed++
            }

            // Steer toward the target. dt-scaled so the word assembles in the
            // same wall-clock time at 30fps as at 60fps — this is what keeps
            // the first word from being swapped out before it exists.
            if (d2 > 0.01) {
              const d = Math.sqrt(d2)
              const s = (spd[i] * (d < CLOSE ? d / CLOSE : 1)) / d
              let ax = dx * s - vx[i]
              let ay = dy * s - vy[i]
              const m2 = ax * ax + ay * ay
              const f = frc[i]
              if (m2 > f * f) {
                const inv = f / Math.sqrt(m2)
                ax *= inv; ay *= inv
              }
              vx[i] += ax * dt
              vy[i] += ay * dt
            }

            const nx = px[i] += vx[i] * dt
            const ny = py[i] += vy[i] * dt

            // Retire dead particles once they clear the frame, but keep them
            // in the pool so the next word can reuse them.
            if (st === DYING && (nx < -40 || nx > cw + 40 || ny < -40 || ny > ch + 40)) {
              state[i] = DORMANT
              continue
            }

            let w = wt[i]
            if (w < 1) w = wt[i] = Math.min(w + rate[i] * dt, 1)
            const r = (sr[i] + (tr[i] - sr[i]) * w) | 0
            const g = (sg[i] + (tg[i] - sg[i]) * w) | 0
            const b = (sb[i] + (tb[i] - sb[i]) * w) | 0
            if (r < 8 && g < 8 && b < 8) continue   // black on black

            const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
            let bucket = buckets[key]
            if (bucket === undefined) bucket = buckets[key] = []
            if (bucket.length === 0) activeKeys.push(key)
            bucket.push(nx, ny)
          }

          for (let k = 0; k < activeKeys.length; k++) {
            const key = activeKeys[k]
            let style = bucketStr[key]
            if (style === undefined) {
              style = bucketStr[key] =
                `rgb(${((key >> 10) & 31) << 3},${((key >> 5) & 31) << 3},${(key & 31) << 3})`
            }
            ctx.fillStyle = style
            const bucket = buckets[key]!
            for (let i = 0; i < bucket.length; i += 2) ctx.fillRect(bucket[i], bucket[i + 1], 2, 2)
          }

          /* Formation tracking drives both word pacing and showPoints()
             callbacks: nothing advances on a stopwatch alone, so every cloud
             is guaranteed to be seen assembled however slow the device.
             maxMs is the escape hatch if one somehow never forms. */
          if (formedAt === null && live > 0 && formed / live >= FORMED_PCT) formedAt = now
          const timedOut = now - wordStart >= maxMs

          if (pendingFormed && (formedAt !== null || timedOut)) {
            const cb = pendingFormed
            pendingFormed = null
            cb()
          }

          if (manual || !autoAdvance || finished) return

          const settled = formedAt !== null && now - formedAt >= holdMs

          if (settled || timedOut) {
            const next = wordIndex + 1
            if (next < words.length) {
              wordIndex = next
              showCloud(clouds[next])
              cbRef.current.onWordCycle?.(next, words[next])
              wordStart = now
              formedAt = null
            } else {
              finished = true
              cbRef.current.onCycleComplete?.()
            }
          }
        }

        apiRef.current = {
          nextWord(word: string) {
            const idx = words.indexOf(word)
            const cloud = idx >= 0 ? clouds[idx] : sampleCloud(off, word, cw, ch, size, fontFamily, budget)
            wordIndex = idx >= 0 ? idx : wordIndex
            showCloud(cloud)
            wordStart = performance.now()
            formedAt = null
          },
          showPoints(cloud: Cloud, onFormed?: () => void) {
            manual = true
            pendingFormed = onFormed ?? null
            showCloud(cloud)
            wordStart = performance.now()
            formedAt = null
          },
          killAll() {
            for (let i = 0; i < cap; i++) kill(i)
          },
        }

        rafRef.current = requestAnimationFrame(animate)
      }

      /* The display font is loaded with font-display:swap, so sampling
         immediately would trace the fallback face's glyphs. Wait for it, but
         never longer than 600ms. */
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
      if (fonts?.load) {
        Promise.race([
          fonts.load(`${fontSize}px ${fontFamily}`).catch(() => {}),
          new Promise((r) => setTimeout(r, 600)),
        ]).then(boot)
      } else {
        boot()
      }

      return () => {
        cancelled = true
        cancelAnimationFrame(rafRef.current)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        aria-hidden="true"
      />
    )
  }
)
