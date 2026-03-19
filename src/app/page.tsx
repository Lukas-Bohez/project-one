export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-100 text-slate-900 dark:from-[#020617] dark:via-[#040a18] dark:to-[#0f172a] dark:text-slate-100">
      <main className="mx-auto w-full max-w-6xl p-6 sm:p-10">
        <header className="mb-12 rounded-3xl border border-slate-200 bg-white/75 p-8 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300">
            Lukas Bohez
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
            Frontend Developer & Designer
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
              href="#contact"
              className="rounded-full border border-blue-700 px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:border-blue-300 dark:text-blue-300 dark:hover:bg-blue-400"
            >
              Let’s talk
            </a>
          </div>
        </header>

        <section className="mb-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl bg-white/80 p-6 shadow-sm dark:bg-slate-800/75">
            <h2 className="text-xl font-bold">About Me</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              I’m a practicing web developer specializing in modern React/Next.js applications. I
              focus on performance, accessibility and maintenance through strong architecture and
              component design.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
              <li>4+ years of frontend experience</li>
              <li>Next.js 16, React 19, TypeScript, TailwindCSS</li>
              <li>Responsive design + performance optimizations</li>
              <li>Automated testing & CI/CD pipeline</li>
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
              <h3 className="text-lg font-semibold">Portfolio Redesign</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                A fully responsive and accessible portfolio built with Next.js App Router, typed
                with TypeScript, and styled using TailwindCSS.
              </p>
              <a
                className="mt-4 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                href="#"
              >
                Live demo ↗
              </a>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-lg font-semibold">UI Component Library</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Reusable components with strict types and built-in accessibility, including buttons,
                form fields, modals and dark mode support.
              </p>
              <a
                className="mt-4 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                href="#"
              >
                GitHub source ↗
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
                href="mailto:lukas@example.com"
              >
                lukas@example.com
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
          © {new Date().getFullYear()} Lukas Bohez. Built with Next.js.
        </footer>
      </main>
    </div>
  );
}
