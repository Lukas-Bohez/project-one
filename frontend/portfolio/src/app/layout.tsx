import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lukas Bohez Portfolio | Full-Stack Engineer',
  description:
    'Lukas Bohez is a full-stack software engineer specializing in Next.js, performance architecture, and privacy-first products.',
  keywords: [
    'Lukas Bohez',
    'portfolio',
    'full-stack developer',
    'Next.js',
    'React',
    'TypeScript',
    'performance',
    'web accessibility',
  ],
  openGraph: {
    title: 'Lukas Bohez Portfolio',
    description:
      'Explore the portfolio of Lukas Bohez, a software engineer focused on solid architecture, performance, and resilience.',
    url: 'https://lbohez.dev',
    siteName: 'Lukas Bohez Portfolio',
    images: [
      {
        url: 'https://lbohez.dev/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Lukas Bohez Portfolio Open Graph',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lukas Bohez Portfolio',
    description:
      'Full-stack portfolio of Lukas Bohez, with Next.js performance, security, and accessibility emphasis.',
    creator: '@LukasBohez',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
