'use client';

import { motion } from 'framer-motion';

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M${-380 * position + i * 5 * position} ${180 + i * 8}C${
      -300 * position + i * 4 * position
    } ${80 + i * 6},${200 * position + i * 3 * position} ${
      20 + i * 5
    },${400 * position + i * 8 * position} ${-20 + i * 4}`,
    width: 0.5 + i * 0.05,
    opacity: 0.12 + i * 0.022,
  }));

  return (
    <svg
      className="sc-bg-svg"
      viewBox="0 0 696 316"
      fill="none"
      aria-hidden="true"
    >
      {paths.map((p) => (
        <motion.path
          key={p.id}
          d={p.d}
          stroke="url(#gold-grad)"
          strokeWidth={p.width}
          strokeOpacity={p.opacity}
          initial={{ pathLength: 0.2, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: [p.opacity * 0.4, p.opacity, p.opacity * 0.4],
            pathOffset: [0, 1],
          }}
          transition={{
            pathLength: { duration: 0, delay: 0 },
            opacity: {
              duration: 4 + (p.id % 6) * 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: p.id * 0.15,
            },
            pathOffset: {
              duration: 18 + (p.id % 8) * 3,
              repeat: Infinity,
              ease: 'linear',
              delay: p.id * 0.2,
            },
          }}
        />
      ))}
      <defs>
        <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c9a84c" />
          <stop offset="50%" stopColor="#e2c973" />
          <stop offset="100%" stopColor="#a07830" />
        </linearGradient>
      </defs>
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
