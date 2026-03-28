'use client';

import { Section } from './Section';

export function ContactSection() {
  const links = [
    {
      name: 'Email',
      href: 'mailto:lukasbohez@gmail.com',
      description: 'Reach out for contract and full-time opportunities.',
    },
    {
      name: 'GitHub',
      href: 'https://github.com/Lukas-Bohez',
      description: 'Review code samples and open-source work.',
    },
    {
      name: 'Buy Me a Coffee',
      href: 'https://buymeacoffee.com/OrokaConner',
      description: 'Support my work with a small one-time contribution.',
    },
  ];

  return (
    <Section title="Let’s connect" subtitle="Open for mid/senior full-stack roles">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-2xl border p-4 text-sm shadow-sm transition hover:-translate-y-1 hover:shadow-md bg-[color:var(--surface)] text-[color:var(--foreground)] border-[color:var(--border)]"
            style={{ boxShadow: 'var(--shadow)' }}
          >
            <h3 className="font-semibold">{link.name}</h3>
            <p className="mt-1 text-xs text-[color:var(--foreground)]">{link.description}</p>
          </a>
        ))}
      </div>
    </Section>
  );
}
