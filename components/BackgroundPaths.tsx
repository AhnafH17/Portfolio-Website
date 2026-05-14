"use client";

import { motion } from "framer-motion";
import { memo, useMemo } from "react";

interface Point { x: number; y: number; }
interface PathData { id: string; d: string; opacity: number; width: number; }

function generateAestheticPath(index: number, position: number, type: "primary" | "secondary" | "accent"): string {
  const baseAmplitude = type === "primary" ? 150 : type === "secondary" ? 100 : 60;
  const phase = index * 0.2;
  const points: Point[] = [];
  const segments = type === "primary" ? 10 : type === "secondary" ? 8 : 6;

  const startX = 2400;
  const startY = 800;
  const endX = -2400;
  const endY = -800 + index * 25;

  for (let i = 0; i <= segments; i++) {
    const progress = i / segments;
    const eased = 1 - (1 - progress) ** 2;
    const baseX = startX + (endX - startX) * eased;
    const baseY = startY + (endY - startY) * eased;
    const amplitudeFactor = 1 - eased * 0.3;
    const wave1 = Math.sin(progress * Math.PI * 3 + phase) * (baseAmplitude * 0.7 * amplitudeFactor);
    const wave2 = Math.cos(progress * Math.PI * 4 + phase) * (baseAmplitude * 0.3 * amplitudeFactor);
    const wave3 = Math.sin(progress * Math.PI * 2 + phase) * (baseAmplitude * 0.2 * amplitudeFactor);
    points.push({ x: baseX * position, y: baseY + wave1 + wave2 + wave3 });
  }

  return points.map((pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const t = 0.4;
    return `C ${prev.x + (pt.x - prev.x) * t} ${prev.y}, ${prev.x + (pt.x - prev.x) * (1 - t)} ${pt.y}, ${pt.x} ${pt.y}`;
  }).join(" ");
}

const uid = (p: string) => `${p}-${Math.random().toString(36).substr(2, 9)}`;

const FloatingPaths = memo(function FloatingPaths({ position }: { position: number }) {
  const primary: PathData[] = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: uid("p"), d: generateAestheticPath(i, position, "primary"),
    opacity: 0.12 + i * 0.018, width: 3 + i * 0.25,
  })), [position]);

  const secondary: PathData[] = useMemo(() => Array.from({ length: 15 }, (_, i) => ({
    id: uid("s"), d: generateAestheticPath(i, position, "secondary"),
    opacity: 0.09 + i * 0.013, width: 2 + i * 0.2,
  })), [position]);

  const accent: PathData[] = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: uid("a"), d: generateAestheticPath(i, position, "accent"),
    opacity: 0.06 + i * 0.01, width: 1.5 + i * 0.15,
  })), [position]);

  return (
    <div className="sc-bg-paths">
      <svg className="sc-bg-svg" fill="none" preserveAspectRatio="xMidYMid slice" viewBox="-2400 -800 4800 1600">
        <defs>
          <linearGradient id="goldGrad" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%"   stopColor="rgba(120,80,10,0.4)" />
            <stop offset="40%"  stopColor="rgba(201,168,76,0.7)" />
            <stop offset="70%"  stopColor="rgba(226,201,115,0.8)" />
            <stop offset="100%" stopColor="rgba(160,120,48,0.3)" />
          </linearGradient>
        </defs>

        <g>
          {primary.map((p) => (
            <motion.path key={p.id} d={p.d} stroke="url(#goldGrad)" strokeLinecap="round" strokeWidth={p.width}
              style={{ opacity: p.opacity }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: p.opacity, scale: 1, y: [0, -15, 0] }}
              transition={{ opacity: { duration: 1 }, scale: { duration: 1 }, y: { duration: 8, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" } }}
            />
          ))}
        </g>
        <g style={{ opacity: 0.8 }}>
          {secondary.map((p) => (
            <motion.path key={p.id} d={p.d} stroke="url(#goldGrad)" strokeLinecap="round" strokeWidth={p.width}
              style={{ opacity: p.opacity }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: p.opacity, scale: 1, y: [0, -10, 0] }}
              transition={{ opacity: { duration: 1 }, scale: { duration: 1 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" } }}
            />
          ))}
        </g>
        <g style={{ opacity: 0.6 }}>
          {accent.map((p) => (
            <motion.path key={p.id} d={p.d} stroke="url(#goldGrad)" strokeLinecap="round" strokeWidth={p.width}
              style={{ opacity: p.opacity }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: p.opacity, scale: 1, y: [0, -5, 0] }}
              transition={{ opacity: { duration: 1 }, scale: { duration: 1 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" } }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
});

export default memo(function BackgroundPaths() {
  return (
    <>
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </>
  );
});
