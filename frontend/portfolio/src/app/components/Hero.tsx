'use client';

import { motion, useReducedMotion } from 'framer-motion';

type HeroProps = {
  onScrollToProjects: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
};

export function Hero({ onScrollToProjects, darkMode, onToggleDarkMode }: HeroProps) {
  const reducedMotion = useReducedMotion();

  const sectionVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: reducedMotion
        ? { duration: 0 }
        : { type: 'spring', stiffness: 200, damping: 22, staggerChildren: 0.15 },
    },
  };

  const headingVariant = {
    hidden: { opacity: 0, y: 32, x: -16, rotate: -3 },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      rotate: 0,
      transition: { delay: 0, type: 'spring', stiffness: 180, damping: 22 },
    },
  };

  const sharedItem = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 180, damping: 20 },
    },
  };

  return (
    <motion.section
      className="mb-10 rounded-3xl border p-8 shadow-lg backdrop-blur bg-[color:var(--surface)]/90 text-[color:var(--foreground)] border-[color:var(--border)]"
      style={{ boxShadow: 'var(--shadow)' }}
      variants={sectionVariants}
      initial={reducedMotion ? 'visible' : 'hidden'}
      animate="visible"
    >
      <motion.p
        variants={sharedItem}
        className="uppercase tracking-widest text-[color:var(--foreground)]"
      >
        Software Developer
      </motion.p>
      <motion.h1
        variants={headingVariant}
        className="mt-2 text-4xl font-extrabold leading-tight sm:text-6xl"
      >
        Lukas Bohez
      </motion.h1>
      <motion.p
        variants={sharedItem}
        className="mt-4 max-w-3xl text-lg leading-relaxed text-[color:var(--foreground)]"
      >
        I deliver security-first, performance-driven platforms in high-demand production. From
        bootstrapped feature launches to enterprise-grade uptime architectures,
        <br />
        <span className="whitespace-nowrap">
          I help teams ship with resilience and developer velocity.
        </span>
      </motion.p>

      <motion.div variants={sharedItem} className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onScrollToProjects}
          data-cursor-label="Explore"
          className="cursor-hover cta rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-[color:var(--accent-contrast)] hover:bg-[color:var(--accent-contrast)] hover:text-[color:var(--accent)]"
        >
          View featured work
        </button>
        <button
          onClick={onToggleDarkMode}
          data-cursor-label="Toggle"
          className="cursor-hover cta rounded-full border border-[color:var(--accent)] bg-[color:var(--surface-muted)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface)]"
        >
          {darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        </button>
      </motion.div>

      <motion.div
        variants={sharedItem}
        className="mt-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm"
      >
        <p>📍 West-Vlaanderen, Belgium</p>
        <p>🎓 MCT @ Howest</p>
        <p>🔍 Open for mid/senior full-stack roles</p>
        <p>🌐 Building: quizthespire.com</p>
        <p>📖 Learning: Japanese</p>
      </motion.div>
    </motion.section>
  );
}
