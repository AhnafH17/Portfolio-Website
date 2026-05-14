'use client';

import { motion } from 'framer-motion';

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    // Diagonal sweep: top-left → bottom-right (or mirrored)
    d: `M${position > 0 ? -200 + i * 18 : 1600 - i * 18} ${-100}C${
      position > 0 ? 100 + i * 20 : 1300 - i * 20
    } ${250},${
      position > 0 ? 600 + i * 15 : 800 - i * 15
    } ${500},${
      position > 0 ? 1100 + i * 12 : 300 - i * 12
    } ${900}`,
    width: 0.4 + i * 0.03,
    opacity: 0.04 + i * 0.006,
    duration: 5 + (i % 6) * 1.5,
    delay: i * 0.22,
  }));

  const gradId = `gg-${position > 0 ? 'a' : 'b'}`;

  return (
    <svg
      className="sc-bg-svg"
      viewBox="0 0 1400 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#c9a84c" stopOpacity="0" />
          <stop offset="35%"  stopColor="#c9a84c" />
          <stop offset="65%"  stopColor="#e2c973" />
          <stop offset="100%" stopColor="#a07830" stopOpacity="0" />
        </linearGradient>
      </defs>
      {paths.map((p) => (
        <motion.path
          key={p.id}
          d={p.d}
          stroke={`url(#${gradId})`}
          strokeWidth={p.width}
          fill="none"
          animate={{
            opacity: [p.opacity, p.opacity * 2.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </svg>
  );
}

export default function BackgroundPaths() {
  return (
    <div className="sc-bg-paths" aria-hidden="true">
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  );
}
