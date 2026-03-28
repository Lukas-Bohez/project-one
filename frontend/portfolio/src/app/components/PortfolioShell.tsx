'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { AboutAndSkills } from './AboutAndSkills';
import { ContactSection } from './ContactSection';
import { Hero } from './Hero';
import { Stats } from './Stats';

type PortfolioShellProps = {
  children: React.ReactNode;
};

export default function PortfolioShell({ children }: PortfolioShellProps) {
  const [progress, setProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isScrollable, setIsScrollable] = useState(false);
  const [showScrollCue, setShowScrollCue] = useState(true);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);
  const [cursorLabel, setCursorLabel] = useState('');
  const [cursorActive, setCursorActive] = useState(false);
  const isBrowser = typeof document !== 'undefined';
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [reduceMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !reduceMotion && !prefersReducedMotion;

  const lastScrollYRef = useRef(0);
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const now = performance.now();
      const dt = Math.max(1, now - lastTimestampRef.current);
      const dy = y - lastScrollYRef.current;
      const previousDirection = scrollDirectionRef.current;
      const currentDirection =
        y > lastScrollYRef.current + 8
          ? 'down'
          : y < lastScrollYRef.current - 8
            ? 'up'
            : previousDirection;
      const velocity = Math.min(1.6, (Math.abs(dy) / dt) * 1.5);

      setScrollDirection(currentDirection);
      scrollDirectionRef.current = currentDirection;
      lastScrollYRef.current = y;
      lastTimestampRef.current = now;
      setScrollVelocity((prev) => (reduceMotion ? 0 : Math.max(prev * 0.88, velocity)));

      const total = document.documentElement.scrollHeight - window.innerHeight;
      setIsScrollable(total > 0);
      setHeaderScrolled(y > 10);

      if (total <= 0) {
        // Non-scrollable pages should show 0% progress; avoid a stale "100%" state.
        setProgress(0);
      } else {
        const scrolled = (y / total) * 100;
        setProgress(Math.min(100, Math.max(0, scrolled)));
      }

      setShowScrollCue(y < 60);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [reduceMotion]);

  // Avoid direct `setState` in effect by deriving this from client runtime.
  // `isBrowser` will be false during server render and true in browser.

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Use native scrolling for performance and avoid heavy smooth-scroll library behavior.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Could configure `scroll-behaviour: smooth` in CSS for soft movement.
    document.documentElement.style.scrollBehavior = 'smooth';

    return () => {
      if (document.documentElement.style.scrollBehavior === 'smooth') {
        document.documentElement.style.scrollBehavior = '';
      }
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      setCursorX(event.clientX);
      setCursorY(event.clientY);

      const interactive = target.closest('.cursor-hover') as HTMLElement | null;
      if (interactive) {
        setCursorLabel(interactive.dataset.cursorLabel || 'Open');
        setCursorActive(true);
      } else {
        setCursorLabel('');
        setCursorActive(false);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  const scrollToProjects = () => {
    const elem = document.getElementById('projects');
    if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollIntensity = reduceMotion ? 0 : Math.min(0.85, 0.15 + scrollVelocity * 0.75);
  const overlayDuration = reduceMotion ? '0ms' : '200ms';

  const topOverlayAlpha = scrollDirection ? scrollIntensity : 0;
  const bottomOverlayAlpha = scrollDirection ? scrollIntensity : 0;

  const backToTopRingRadius = 16;
  const backToTopCircumference = 2 * Math.PI * backToTopRingRadius;
  const backToTopOffset = backToTopCircumference - (backToTopCircumference * progress) / 100;

  const topOverlayGradient =
    scrollDirection === 'down'
      ? 'linear-gradient(var(--background), transparent)'
      : 'linear-gradient(transparent, var(--background))';

  const bottomOverlayGradient =
    scrollDirection === 'down'
      ? 'linear-gradient(transparent, var(--background))'
      : 'linear-gradient(var(--background), transparent)';

  const cursorPortal =
    isBrowser &&
    createPortal(
      <div
        className="custom-cursor"
        style={{
          transform: `translate3d(${cursorX}px, ${cursorY}px, 0)`,
        }}
      >
        <span>{cursorLabel || '\u00A0'}</span>
      </div>,
      document.body
    );

  return (
    <div>
      {cursorPortal}
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-[color:var(--foreground)]/20">
        <div
          style={{
            width: `${progress}%`,
            backgroundColor: 'var(--foreground)',
            transitionDuration: overlayDuration,
          }}
          className="h-full transition-all"
        />
      </div>

      <div className="noise-overlay" />
      <div
        className="fixed inset-x-0 top-0 h-16 pointer-events-none"
        style={{
          backgroundImage: topOverlayGradient,
          opacity: topOverlayAlpha,
          transition: `opacity ${overlayDuration} ease-out`,
        }}
      />

      <button
        className="back-to-top-ring"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <svg viewBox="0 0 40 40" width="40" height="40">
          <circle cx="20" cy="20" r="16" className="background-ring" />
          <circle
            cx="20"
            cy="20"
            r="16"
            className="progress-ring"
            style={{
              strokeDasharray: backToTopCircumference,
              strokeDashoffset: backToTopOffset,
            }}
          />
        </svg>
        <span className="relative z-10 text-xs select-none">↑</span>
      </button>
      <div
        className="fixed inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{
          backgroundImage: bottomOverlayGradient,
          opacity: bottomOverlayAlpha,
          transition: `opacity ${overlayDuration} ease-out`,
        }}
      />

      <header
        className={`fixed inset-x-0 top-0 z-40 h-14 border-b bg-[color:var(--surface)]/80 backdrop-blur transition-all duration-300 ${
          headerScrolled ? 'scrolled' : ''
        }`}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 text-sm">
          <span className="font-bold">Lukas Bohez</span>
          <span className="text-[color:var(--foreground)]">Full-stack Software Engineer</span>
        </div>
      </header>

      <div
        className={`fixed left-1/2 z-50 -translate-x-1/2 bottom-8 overflow-hidden rounded-full ${
          !motionEnabled || !isScrollable || !showScrollCue
            ? 'opacity-0 pointer-events-none'
            : 'opacity-100'
        } scroll-dot-container`}
        aria-label="Scroll down indicator"
      >
        <div className="scroll-dot h-3 w-3 rounded-full bg-[color:var(--foreground)]" />
      </div>

      <main
        className={`custom-cursor-container ${cursorActive ? 'hide-native-cursor' : ''} mx-auto w-full max-w-6xl p-6 sm:p-10 pt-20`}
      >
        <Hero
          onScrollToProjects={scrollToProjects}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        />
        <Stats />
        <AboutAndSkills />

        {children}

        <ContactSection />

        <footer className="mt-8 border-t border-slate-200 dark:border-zinc-700 pt-4 text-center text-sm text-slate-700 dark:text-zinc-300">
          © {new Date().getFullYear()} Lukas Bohez. Built with Next.js.
        </footer>
      </main>
    </div>
  );
}
