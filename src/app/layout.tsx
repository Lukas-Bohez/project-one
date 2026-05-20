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
  metadataBase: new URL('https://quizthespire.com'),
  title: {
    default: 'Lukas Bohez | Quiz The Spire',
    template: '%s | Lukas Bohez',
  },
  description:
    'Lukas Bohez builds accessible, high-performance web apps, Flutter tools, and Quiz The Spire.',
  keywords: ['Lukas Bohez', 'Quiz The Spire', 'Next.js', 'Python', 'Flutter', 'Web Development'],
  authors: [{ name: 'Lukas Bohez', url: 'https://github.com/Lukas-Bohez' }],
  creator: 'Lukas Bohez',
  publisher: 'Lukas Bohez',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Lukas Bohez | Quiz The Spire',
    description:
      'Portfolio and project hub for Lukas Bohez, with Quiz The Spire, Flutter, and backend tooling.',
    url: 'https://quizthespire.com',
    siteName: 'Quiz The Spire',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lukas Bohez | Quiz The Spire',
    description:
      'Portfolio and project hub for Lukas Bohez, with Quiz The Spire, Flutter, and backend tooling.',
  },
  robots: {
    index: true,
    follow: true,
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
