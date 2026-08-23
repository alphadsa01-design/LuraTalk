import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Call History — LuraTalk',
  description: 'View your recent anonymous voice calls, call durations, and connections.',
  alternates: {
    canonical: 'https://luratalk.vercel.app/history',
  },
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
