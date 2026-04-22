export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-100 text-slate-900 dark:from-[#020617] dark:via-[#040a18] dark:to-[#0f172a] dark:text-slate-100">
      <main className="mx-auto w-full max-w-6xl p-6 sm:p-10">
        <header className="mb-12 rounded-3xl border border-slate-200 bg-white/75 p-8 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300">
            Oroka Conner
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
            Full-Stack Developer · Flutter · Python · Next.js
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Crafting accessible, responsive, and aesthetic web experiences with Next.js, TypeScript,
            and TailwindCSS. I love taking projects from concept to deploy, with clean code and
            strong UX.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#projects"
              className="rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              View projects
            </a>
            <a
              href="#support"
              className="rounded-full border border-blue-700 px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:border-blue-300 dark:text-blue-300 dark:hover:bg-blue-400"
            >
              Support my work
            </a>
          </div>
        </header>

        <section
          id="support"
          className="mb-10 rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
        >
          <h2 className="text-xl font-bold">Support My Work</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            If you find my tools and open-source contributions useful, support me so I can keep
            building practical, privacy-focused software.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://github.com/sponsors/Lukas-Bohez"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              GitHub Sponsors
            </a>
            <a
              href="https://buymeacoffee.com/LukasBohez"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-500/20"
            >
              Buy Me a Coffee
            </a>
          </div>
        </section>

        <section className="mb-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl bg-white/80 p-6 shadow-sm dark:bg-slate-800/75">
            <h2 className="text-xl font-bold">About Me</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Full-Stack software engineer specialized in Python backend systems and Dart/Flutter
              cross-platform apps. I ship high-performance media infrastructure with self-hosted
              tooling, then optimize for reliability and security on Raspberry Pi and Linux.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
              <li>Python (backend), Dart/Flutter (cross-platform), JavaScript, HTML/CSS, C++</li>
              <li>FastAPI, Docker, Apache2, Linux server orchestration (24/7 production)</li>
              <li>Media systems: yt-dlp, FFmpeg, youtube_explode_dart, streaming conversions</li>
              <li>DBs: MySQL, SQLite, JSON state management</li>
              <li>CI/CD & code quality: GitHub Actions, ESLint, Prettier</li>
            </ul>
          </article>
          <article className="rounded-2xl bg-white/80 p-6 shadow-sm dark:bg-slate-800/75">
            <h2 className="text-xl font-bold">Skills</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-3">
              {['Next.js', 'React', 'TypeScript', 'TailwindCSS', 'HTML', 'CSS'].map((skill) => (
                <span
                  key={skill}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-center dark:bg-slate-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section id="projects" className="mb-10">
          <h2 className="text-2xl font-bold">Featured Projects</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-lg font-semibold">ConvertTheSpireFlutter</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Open-source Flutter desktop and mobile app for downloading and converting
                media from 1,800+ sites. Features 4K/8K downloads, 27+ format conversions,
                built-in media player, torrent management, DLNA casting, and a built-in
                browser. 1,000+ downloads across 95+ countries. GPLv3 licensed.
              </p>
              <a
                className="mt-4 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                href="https://github.com/Lukas-Bohez/ConvertTheSpireFlutter"
                target="_blank"
                rel="noreferrer noopener"
              >
                Repository ↗
              </a>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-lg font-semibold">QuizTheSpire</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Full-stack live multiplayer quiz platform. Supports real-time leaderboards,
                AI-generated themes via SpireAI, and community-created content. Built with
                vanilla JS, Apache2, and a Python backend. Serving users across 95+ countries.
              </p>
              <a
                className="mt-4 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                href="https://quizthespire.com"
                target="_blank"
                rel="noreferrer noopener"
              >
                Live App ↗
              </a>
            </article>
          </div>
        </section>

        <section
          id="contact"
          className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/75"
        >
          <h2 className="text-2xl font-bold">Contact</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            I’m open to new projects and collaboration. Connect on LinkedIn or send an email below.
          </p>
          <ul className="mt-4 space-y-2 text-slate-700 dark:text-slate-300">
            <li>
              Email:{' '}
              <a
                className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                href="https://quizthespire.com/pages/contact/"
                target="_blank"
                rel="noreferrer noopener"
              >
                Contact via Quiz The Spire →
              </a>
            </li>
            <li>
              GitHub:{' '}
              <a
                className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                href="https://github.com/Lukas-Bohez"
                target="_blank"
                rel="noreferrer noopener"
              >
                github.com/Lukas-Bohez
              </a>
            </li>
            <li>
              LinkedIn:{' '}
              <a
                className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                href="https://linkedin.com/in/lukas-bohez"
                target="_blank"
                rel="noreferrer noopener"
              >
                linkedin.com/in/lukas-bohez
              </a>
            </li>
          </ul>
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          © {new Date().getFullYear()} Oroka Conner. Built with Next.js.
        </footer>
      </main>
    </div>
  );
}
