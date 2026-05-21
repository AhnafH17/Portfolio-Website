"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"

interface Vector2D {
  x: number
  y: number
}

class Particle {
  pos: Vector2D = { x: 0, y: 0 }
  vel: Vector2D = { x: 0, y: 0 }
  acc: Vector2D = { x: 0, y: 0 }
  target: Vector2D = { x: 0, y: 0 }

  closeEnoughTarget = 100
  maxSpeed = 1.0
  maxForce = 0.1
  particleSize = 10
  isKilled = false

  startColor = { r: 0, g: 0, b: 0 }
  targetColor = { r: 0, g: 0, b: 0 }
  colorWeight = 0
  colorBlendRate = 0.01

  move() {
    let proximityMult = 1
    const distance = Math.sqrt(
      Math.pow(this.pos.x - this.target.x, 2) + Math.pow(this.pos.y - this.target.y, 2)
    )
    if (distance < this.closeEnoughTarget) {
      proximityMult = distance / this.closeEnoughTarget
    }

    const towardsTarget = {
      x: this.target.x - this.pos.x,
      y: this.target.y - this.pos.y,
    }
    const magnitude = Math.sqrt(towardsTarget.x ** 2 + towardsTarget.y ** 2)
    if (magnitude > 0) {
      towardsTarget.x = (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult
      towardsTarget.y = (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult
    }

    const steer = { x: towardsTarget.x - this.vel.x, y: towardsTarget.y - this.vel.y }
    const steerMag = Math.sqrt(steer.x ** 2 + steer.y ** 2)
    if (steerMag > 0) {
      steer.x = (steer.x / steerMag) * this.maxForce
      steer.y = (steer.y / steerMag) * this.maxForce
    }

    this.acc.x += steer.x
    this.acc.y += steer.y
    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.colorWeight < 1.0) {
      this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0)
    }
    const r = Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight)
    const g = Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight)
    const b = Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(this.pos.x, this.pos.y, 2, 2)
  }

  kill(width: number, height: number) {
    if (!this.isKilled) {
      const randomPos = randomPosOnEdge(width / 2, height / 2, (width + height) / 2)
      this.target.x = randomPos.x
      this.target.y = randomPos.y
      this.startColor = {
        r: this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight,
        g: this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight,
        b: this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight,
      }
      this.targetColor = { r: 0, g: 0, b: 0 }
      this.colorWeight = 0
      this.isKilled = true
    }
  }
}

function randomPosOnEdge(cx: number, cy: number, mag: number): Vector2D {
  const angle = Math.random() * Math.PI * 2
  return { x: cx + Math.cos(angle) * mag, y: cy + Math.sin(angle) * mag }
}

// Gold color palette matching portfolio
const GOLD_COLORS = [
  { r: 201, g: 168, b: 76 },
  { r: 226, g: 201, b: 115 },
  { r: 255, g: 232, b: 140 },
  { r: 180, g: 130, b: 48 },
  { r: 255, g: 248, b: 200 },
]

export interface ParticleTextHandle {
  nextWord: (word: string) => void
  killAll: () => void
}

export interface ParticleTextEffectProps {
  words?: string[]
  autoAdvance?: boolean
  intervalMs?: number
  onWordCycle?: (index: number, word: string) => void
  onCycleComplete?: () => void
  fontSize?: number
  fontFamily?: string
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
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number>(0)
    const particlesRef = useRef<Particle[]>([])
    const frameCountRef = useRef(0)
    const wordIndexRef = useRef(0)
    const lastAdvanceRef = useRef(0)

    const showWord = (word: string, canvas: HTMLCanvasElement) => {
      const offscreen = document.createElement("canvas")
      offscreen.width = canvas.width
      offscreen.height = canvas.height
      const ctx2 = offscreen.getContext("2d")!

      ctx2.fillStyle = "white"
      ctx2.font = `bold ${fontSize}px ${fontFamily}`
      ctx2.textAlign = "center"
      ctx2.textBaseline = "middle"
      ctx2.fillText(word, canvas.width / 2, canvas.height / 2)

      const imageData = ctx2.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data
      const newColor = GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)]

      const particles = particlesRef.current
      let particleIndex = 0

      // Collect + shuffle pixel coords for fluid formation
      const coords: number[] = []
      for (let i = 0; i < pixels.length; i += 6 * 4) coords.push(i)
      for (let i = coords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[coords[i], coords[j]] = [coords[j], coords[i]]
      }

      for (const idx of coords) {
        if (pixels[idx + 3] <= 0) continue
        const x = (idx / 4) % canvas.width
        const y = Math.floor(idx / 4 / canvas.width)

        let p: Particle
        if (particleIndex < particles.length) {
          p = particles[particleIndex]
          p.isKilled = false
          particleIndex++
        } else {
          p = new Particle()
          const spawn = randomPosOnEdge(canvas.width / 2, canvas.height / 2, (canvas.width + canvas.height) / 2)
          p.pos.x = spawn.x
          p.pos.y = spawn.y
          p.maxSpeed = Math.random() * 6 + 4
          p.maxForce = p.maxSpeed * 0.05
          p.particleSize = Math.random() * 6 + 6
          p.colorBlendRate = Math.random() * 0.0275 + 0.0025
          particles.push(p)
        }

        p.startColor = {
          r: p.startColor.r + (p.targetColor.r - p.startColor.r) * p.colorWeight,
          g: p.startColor.g + (p.targetColor.g - p.startColor.g) * p.colorWeight,
          b: p.startColor.b + (p.targetColor.b - p.startColor.b) * p.colorWeight,
        }
        p.targetColor = newColor
        p.colorWeight = 0
        p.target.x = x
        p.target.y = y
      }

      for (let i = particleIndex; i < particles.length; i++) {
        particles[i].kill(canvas.width, canvas.height)
      }
    }

    // Expose imperative API for parent (Preloader) to control
    useImperativeHandle(ref, () => ({
      nextWord(word: string) {
        const canvas = canvasRef.current
        if (canvas) showWord(word, canvas)
      },
      killAll() {
        const canvas = canvasRef.current
        if (!canvas) return
        particlesRef.current.forEach((p) => p.kill(canvas.width, canvas.height))
      },
    }))

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = 1000
      canvas.height = 400

      showWord(words[0], canvas)
      lastAdvanceRef.current = performance.now()

      const animate = (now: number) => {
        const ctx = canvas.getContext("2d")!
        const particles = particlesRef.current

        // Motion trail fill
        ctx.fillStyle = "rgba(8,6,3,0.18)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          p.move()
          p.draw(ctx)
          if (p.isKilled && (p.pos.x < -50 || p.pos.x > canvas.width + 50 || p.pos.y < -50 || p.pos.y > canvas.height + 50)) {
            particles.splice(i, 1)
          }
        }

        // Auto-advance words on interval
        if (autoAdvance && now - lastAdvanceRef.current >= intervalMs) {
          lastAdvanceRef.current = now
          const nextIdx = (wordIndexRef.current + 1) % words.length
          wordIndexRef.current = nextIdx
          showWord(words[nextIdx], canvas)
          onWordCycle?.(nextIdx, words[nextIdx])
          if (nextIdx === words.length - 1) {
            onCycleComplete?.()
          }
        }

        frameCountRef.current++
        animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)

      return () => {
        cancelAnimationFrame(animationRef.current)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        aria-hidden="true"
      />
    )
  }
)
