import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/master', '/api/'],
      },
    ],
    sitemap: 'https://luratalk.vercel.app/sitemap.xml',
  };
}
