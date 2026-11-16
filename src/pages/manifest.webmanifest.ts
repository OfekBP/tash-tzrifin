import { href } from '../lib/site';

export const GET = () =>
  new Response(
    JSON.stringify({
      name: 'ת״ש חובה בח״א צריפין',
      short_name: 'ת״ש צריפין',
      lang: 'he',
      dir: 'rtl',
      id: href('/'),
      start_url: href('/'),
      scope: href('/'),
      display: 'standalone',
      background_color: '#c5e4fb',
      theme_color: '#cde8fc',
      icons: [
        { src: href('/icons/192.png'), sizes: '192x192', type: 'image/png' },
        { src: href('/icons/512.png'), sizes: '512x512', type: 'image/png' },
        { src: href('/icons/maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
