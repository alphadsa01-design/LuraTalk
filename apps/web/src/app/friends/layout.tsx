import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connections & Friends — LuraTalk',
  description: 'Manage your anonymous connections and past conversation partners on LuraTalk.',
  alternates: {
    canonical: 'https://luratalk.vercel.app/friends',
  },
};

export default function FriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
