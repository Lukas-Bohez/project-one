'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { arcFromBottom, arcFromTop } from '../lib/animationVariants';

interface SectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ id, title, subtitle, children, className = '' }: SectionProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.12 });
  const reducedMotion = useReducedMotion();
  const scrollDirection = useScrollDirection();

  const variants = scrollDirection === 'down' ? arcFromBottom : arcFromTop;
  const animateState = reducedMotion ? 'visible' : isInView ? 'visible' : 'hidden';

  return (
    <motion.section
      ref={ref}
      id={id}
      className={`${className} mb-16 rounded-3xl border p-8 lg:p-10 shadow-lg bg-[color:var(--surface)] text-[color:var(--foreground)] border-[color:var(--border)]`}
      style={{ boxShadow: 'var(--shadow)' }}
      variants={variants}
      initial={reducedMotion ? 'visible' : 'hidden'}
      animate={animateState}
    >
      <div className="mb-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && <p className="mt-2 text-[color:var(--foreground)]">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}
