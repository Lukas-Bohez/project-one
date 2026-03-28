'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Section } from './Section';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { staggerContainer, arcChildFromBottom, arcChildFromTop } from '../lib/animationVariants';

export function AboutAndSkills() {
  const skills = [
    'Next.js',
    'TypeScript',
    'TailwindCSS',
    'React',
    'FastAPI',
    'Docker',
    'GitHub Actions',
    'Linux',
    'Python',
    'MySQL',
    'SQLite',
    'C#',
  ];

  const ref = useRef<HTMLUListElement>(null);
  // Animate once when visible to prevent repeated re-trigger jitter on scroll up/down
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const scrollDirection = useScrollDirection();
  const childVariants = scrollDirection === 'down' ? arcChildFromBottom : arcChildFromTop;

  return (
    <Section className="about-section" title="About Me" subtitle="Who I am, what I ship, and why I care">
      <div className="space-y-6">
        <div>
          <p className="text-[color:var(--foreground)]">
            I deliver security-first, performance-driven platforms in high-demand production. From
            bootstrapped feature launches to enterprise-grade uptime architectures,
            <br />
            <span className="whitespace-nowrap">
              I help teams ship with resilience and developer velocity.
            </span>
          </p>
          <p className="mt-3 text-[color:var(--foreground)]">
            Beyond coding, I run a self-hosted Raspberry Pi 5 production lab 24/7, including full
            Linux administration, Docker orchestration, and Apache2 vhost configuration. I studied
            Multimedia & Creative Technology at Howest, connecting software engineering with design
            thinking. I’m fluent in Dutch (native), English (professional), and currently studying
            Japanese, where cross-cultural linguistic precision shapes how I design APIs and
            interfaces.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[color:var(--foreground)]">
            <li>
              System design with maintainability and observability (alerts, logging, postmortem
              readiness)
            </li>
            <li>Performance tuning and quality engineering across stack</li>
            <li>End-user product focus: usability, accessibility, responsive behavior</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold">Core skills</h3>
          <motion.ul
            ref={ref}
            variants={staggerContainer}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {skills.map((skill) => (
              <motion.li
                key={skill}
                variants={childVariants}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)] transition hover:scale-105 hover:bg-[color:var(--surface-muted)]"
              >
                {skill}
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </div>
    </Section>
  );
}
