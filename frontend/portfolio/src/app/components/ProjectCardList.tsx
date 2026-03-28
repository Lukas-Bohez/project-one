'use client';

import { motion, useInView, useMotionValue, type Variants } from 'framer-motion';
import { useRef, useState, type MouseEvent } from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { staggerContainer, arcChildFromBottom, arcChildFromTop } from '../lib/animationVariants';
import { urlFor } from '../../lib/sanity';

type ProjectData = {
  title: string;
  description: string;
  impactLine: string;
  githubUrl: string;
  thumbnail?: unknown;
  slug?: string;
  techTags?: string[];
};

type ProjectCardListProps = {
  projects: ProjectData[];
};

type ProjectCardProps = {
  project: ProjectData;
  variants: Variants;
  index: number;
};

function ProjectCard({ project, variants, index }: ProjectCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [imageVisible, setImageVisible] = useState(true);

  const onMouseMove = (event: MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const relX = event.clientX - (box.left + box.width / 2);
    const relY = event.clientY - (box.top + box.height / 2);
    x.set(relX * 0.06);
    y.set(relY * 0.06);
  };

  const thumbnailCandidate = project.thumbnail as { _type?: string } | undefined;
  let thumbnail: string | undefined;

  if (thumbnailCandidate && thumbnailCandidate._type === 'image' && project.thumbnail) {
    const candidateUrl = urlFor(project.thumbnail as never);

    if (typeof candidateUrl === 'string') {
      thumbnail = candidateUrl || undefined;
    } else {
      thumbnail = candidateUrl?.width(720).height(400).url() || undefined;
    }
  }

  return (
    <motion.article
      className="project-card cursor-pointer border rounded-2xl border-[color:var(--border)] p-5 shadow-sm bg-[color:var(--surface)] text-[color:var(--foreground)]"
      style={{
        boxShadow: 'var(--shadow)',
        x,
        y,
        animationDelay: `${index * 0.05}s`,
      }}
      variants={variants}
      whileHover={{ scale: 1.02 }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      data-cursor-label="View"
    >
      <div className={`project-thumb ${thumbnail && imageVisible ? 'loaded' : ''}`}>
        {thumbnail && imageVisible ? (
          <motion.img
            src={thumbnail}
            alt={project.title}
            initial={{ scale: 1.1, opacity: 0.7 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            onError={() => {
              setImageVisible(false);
            }}
          />
        ) : null}
      </div>
      <h3 className="text-lg font-semibold">{project.title}</h3>
      <p className="mt-2 text-base text-[color:var(--foreground)]">{project.description}</p>
      <p className="mt-1 text-base italic text-[color:var(--accent)]">{project.impactLine}</p>

      {project.techTags?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {project.techTags.map((tag) => (
            <span key={tag} className="tech-tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <a
        href={project.githubUrl || '#'}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Open ${project.title} project page`}
        className="explore-btn mt-4 inline-flex cursor-hover items-center rounded-full border border-[color:var(--border)] px-3 py-1 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] text-link"
        data-cursor-label="Open"
      >
        Explore <span className="icon-arrow">↗</span>
      </a>
    </motion.article>
  );
}

export function ProjectCardList({ projects }: ProjectCardListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.15 });
  const scrollDirection = useScrollDirection();
  const childVariants = scrollDirection === 'down' ? arcChildFromBottom : arcChildFromTop;

  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className="grid gap-4 grid-cols-1"
    >
      {projects.map((project, index) => (
        <ProjectCard key={project.title} project={project} variants={childVariants} index={index} />
      ))}
    </motion.div>
  );
}
