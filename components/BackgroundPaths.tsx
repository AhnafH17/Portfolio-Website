'use client';

import { motion } from 'framer-motion';

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M${-500 * position + i * 12 * position} ${-50 + i * 22}C${
      -200 * position + i * 10 * position
    } ${150 + i * 15},${300 * position + i * 8 * position} ${
      350 + i * 10
    },${700 * position + i * 14 * position} ${600 + i * 8}`,
    width: 0.6 + i * 0.06,
    baseOpacity: 0.15 + i * 0.018,
    duration: 3 + (i % 5) * 1.2,
    delay: i * 0.18,
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
          <stop offset="25%"  stopColor="#c9a84c" />
          <stop offset="75%"  stopColor="#e2c973" />
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
            opacity: [p.baseOpacity, p.baseOpacity * 1.8, p.baseOpacity],
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
