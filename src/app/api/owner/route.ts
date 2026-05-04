/**
 * Owner bypass setup endpoint.
 * Visit /api/owner?token=YOUR_OWNER_TOKEN to set the bypass cookie.
 * Subsequent requests will skip the rate limit.
 */

export const runtime = 'nodejs';

export function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const ownerToken = process.env.OWNER_TOKEN;

  if (!ownerToken) {
    return new Response('OWNER_TOKEN not configured on server', { status: 500 });
  }
  if (!token || token !== ownerToken) {
    return new Response('forbidden', { status: 403 });
  }

  // Set cookie for 1 year, httpOnly, SameSite=Lax
  const headers = new Headers();
  headers.set(
    'Set-Cookie',
    `bookpass=${ownerToken}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
  );
  headers.set('Location', '/');
  return new Response(null, { status: 302, headers });
}
