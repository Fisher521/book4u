/**
 * Image proxy for douban book covers.
 * 豆瓣 CDN blocks hotlinking via Referer ACL — fetch with douban referer
 * server-side and stream back. Cache aggressively (covers don't change).
 */

export const runtime = 'nodejs';

const ALLOWED_HOSTS = new Set([
  'img1.doubanio.com',
  'img2.doubanio.com',
  'img3.doubanio.com',
  'img9.doubanio.com',
]);

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get('u');
  if (!u) return new Response('missing url', { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return new Response('bad url', { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return new Response('host not allowed', { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        Referer: 'https://book.douban.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!upstream.ok) {
      return new Response('upstream ' + upstream.status, { status: 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000, immutable', // 30 days
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch failed';
    return new Response(message, { status: 502 });
  }
}
