'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { staggerContainer, arcChildFromBottom, arcChildFromTop } from '../lib/animationVariants';

export function Stats() {
  const promos = [
    {
      title: 'Bring your product to market faster',
      subtitle: '35+ launched products with measurable business impact.',
      action: 'Book strategy call',
      href: '#contact',
    },
    {
      title: 'Build with reliability in mind',
      subtitle: '24/7 uptime-driven services and observability-first deployment.',
      action: 'Review case studies',
      href: '#projects',
    },
    {
      title: 'Cut costs while increasing performance',
      subtitle: '+30% speedups delivered through architecture and optimization.',
      action: 'Get performance audit',
      href: '#contact',
    },
  ];

  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.15 });
  const scrollDirection = useScrollDirection();
  const childVariants = scrollDirection === 'down' ? arcChildFromBottom : arcChildFromTop;

  return (
    <motion.div
      ref={ref}
      className="mb-32 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={staggerContainer}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {promos.map((promo) => (
        <motion.article
          key={promo.title}
          className="group rounded-3xl border p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl bg-[color:var(--surface)] text-[color:var(--foreground)] border-[color:var(--border)]"
          style={{ boxShadow: 'var(--shadow)' }}
          variants={childVariants}
        >
          <h3 className="text-xl font-bold leading-tight">{promo.title}</h3>
          <p className="mt-2 text-sm text-[color:var(--foreground)]">{promo.subtitle}</p>
          <a
            href={promo.href}
            className="mt-4 inline-flex rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
          >
            {promo.action}
          </a>
        </motion.article>
      ))}
    </motion.div>
  );
}
