"use client";

import { motion } from "framer-motion";

function FloatingPaths({ position, count = 36 }: { position: number; count?: number }) {
  const paths = Array.from({ length: count }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    opacity: 0.1 + i * 0.03,
  }));

  return (
    <div className="sc-bg-paths">
      <svg className="sc-bg-svg" viewBox="0 0 696 316" fill="none">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="url(#goldGrad)"
            strokeWidth={path.width}
            strokeOpacity={path.opacity}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + (path.id % 10),
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#c9a84c" stopOpacity="0.4" />
            <stop offset="50%"  stopColor="#e2c973" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a07830" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function BackgroundPaths({ count = 36 }: { count?: number }) {
  return (
    <>
      <FloatingPaths position={1} count={count} />
      <FloatingPaths position={-1} count={count} />
    </>
  );
}
