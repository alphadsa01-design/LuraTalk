import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import FloatingCallOverlay from '@/components/FloatingCallOverlay';
import IncomingCallOverlay from '@/components/IncomingCallOverlay';

export const metadata: Metadata = {
  title: 'LuraTalk — Meet Someone Worth Talking To',
  description:
    'A privacy-first social platform for real-time voice and text conversations with smart matchmaking, AI icebreakers, and live translation.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full w-full overflow-x-hidden">
      <body suppressHydrationWarning className="min-h-full w-full overflow-x-hidden flex flex-col bg-background text-foreground selection:bg-primary selection:text-white antialiased">
        {/* Ambient Glowing Orbs */}
        <div className="aura-orb bg-primary/30 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] top-[-50px] left-[-100px] sm:left-[-150px]" />
        <div className="aura-orb bg-secondary/25 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] top-[40%] right-[-120px] sm:right-[-200px]" />
        <div className="aura-orb bg-accent-pink/20 w-[250px] sm:w-[450px] h-[250px] sm:h-[450px] bottom-[-50px] left-[10%] sm:left-[20%]" />

        <Navbar />
        <main className="flex-1 relative z-10 w-full max-w-full overflow-x-hidden">{children}</main>
        <FloatingCallOverlay />
        <IncomingCallOverlay />
      </body>
    </html>
  );
}
