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
  metadataBase: new URL('https://luratalk.vercel.app'),
  title: {
    default: 'LuraTalk — Anonymous Voice Calls & Conversations with Strangers',
    template: '%s | LuraTalk',
  },
  description:
    'Spontaneous, private 1-on-1 voice calls with strangers worldwide. 100% anonymous, sub-100ms ultra-low latency, no sign-ups or tracking required.',
  keywords: [
    'anonymous voice chat',
    'talk to strangers',
    'random voice call',
    'voice call online',
    'free stranger talk',
    'private audio chat',
    'instant voice matchmaking',
    'omegle alternative voice',
    'luratalk',
    'real-time voice communication',
  ],
  authors: [{ name: 'LuraTalk Team', url: 'https://luratalk.vercel.app' }],
  creator: 'LuraTalk',
  publisher: 'LuraTalk',
  alternates: {
    canonical: 'https://luratalk.vercel.app',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'LuraTalk — Anonymous Real-Time Voice Calls with Strangers',
    description:
      'Spontaneous, private 1-on-1 voice calls with strangers worldwide. 100% anonymous, zero tracking, sub-100ms audio.',
    url: 'https://luratalk.vercel.app',
    siteName: 'LuraTalk',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/icon.svg',
        width: 512,
        height: 512,
        alt: 'LuraTalk Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LuraTalk — Anonymous Voice Calls & Matchmaking',
    description: 'Instant, private 1-on-1 voice conversations with strangers around the globe.',
    images: ['/icon.svg'],
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.webmanifest',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'LuraTalk',
  url: 'https://luratalk.vercel.app',
  description:
    'Spontaneous, private 1-on-1 voice calls with strangers worldwide. 100% anonymous, no sign-ups or tracking required.',
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Anonymous 1-on-1 Voice Calls',
    'Real-time WebRTC Audio',
    'Sub-100ms Low Latency Matchmaking',
    'Zero Tracking & No Sign-up',
    'HD Opus Audio Quality',
  ],
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
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
