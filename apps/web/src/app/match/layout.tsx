import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Voice Match — Instant 1-on-1 Anonymous Calls',
  description:
    'Match instantly with someone new around the world for a private, anonymous 1-on-1 voice conversation.',
  alternates: {
    canonical: 'https://luratalk.vercel.app/match',
  },
};

export default function MatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
