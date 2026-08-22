import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import FloatingCallOverlay from '@/components/FloatingCallOverlay';
import IncomingCallOverlay from '@/components/IncomingCallOverlay';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'LuraTalk — Meet Someone Worth Talking To',
  description:
    'A privacy-first social platform for real-time voice and text conversations with smart matchmaking, AI icebreakers, and live translation.',
  openGraph: {
    title: 'LuraTalk — Anonymous Real-Time Voice Conversations',
    description: 'Connect with kindred spirits worldwide through instant voice matches and community topic lounges.',
    url: 'https://luratalk.vercel.app',
    siteName: 'LuraTalk',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LuraTalk — Anonymous Voice Match & Lounges',
    description: 'Instant, privacy-first voice conversations matched by shared interests.',
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full w-full overflow-x-hidden ${inter.variable}`}>
      <body className={`min-h-full w-full overflow-x-hidden flex flex-col bg-background text-foreground selection:bg-primary selection:text-white antialiased font-sans ${inter.className}`}>
        {/* Ambient Cosmic Glowing Background Lighting */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="aura-orb bg-primary/20 w-[450px] sm:w-[650px] h-[450px] sm:h-[650px] -top-12 -left-20 sm:-left-36" />
          <div className="aura-orb bg-secondary/15 w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] top-[35%] -right-24 sm:-right-48" />
          <div className="aura-orb bg-accent-pink/10 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] -bottom-24 left-[20%]" />
        </div>

        <Navbar />
        <main className="flex-1 relative z-10 w-full max-w-full overflow-x-hidden">{children}</main>
        <FloatingCallOverlay />
        <IncomingCallOverlay />
      </body>
    </html>
  );
}
