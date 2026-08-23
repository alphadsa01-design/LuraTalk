import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LuraTalk — Anonymous Voice Conversations',
    short_name: 'LuraTalk',
    description: 'Spontaneous, private 1-on-1 voice calls with strangers worldwide. 100% anonymous.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
