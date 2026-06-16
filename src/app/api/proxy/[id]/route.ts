import { NextRequest } from 'next/server';
import { getReview } from '@/lib/db';
import { rewriteHtml, rewriteCss } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const review = await getReview(params.id);
  if (!review) return new Response('Review not found', { status: 404 });

  const target = req.nextUrl.searchParams.get('url') || review.url;

  let res: Response;
  try {
    res = await fetch(target, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
  } catch (e: any) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px">
       <h2>Couldn't load this page</h2>
       <p style="color:#666">${escapeHtml(target)}</p>
       <p style="color:#b00">${escapeHtml(e?.message || String(e))}</p></body>`,
      { status: 502, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  const finalUrl = res.url || target;
  const ct = res.headers.get('content-type') || '';

  if (ct.includes('text/html')) {
    const html = await res.text();
    const out = rewriteHtml(html, finalUrl, params.id, finalUrl);
    return new Response(out, {
      status: res.status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  if (ct.includes('text/css')) {
    const css = await res.text();
    return new Response(rewriteCss(css, finalUrl, params.id), {
      status: res.status,
      headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    });
  }

  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: res.status,
    headers: {
      'content-type': ct || 'application/octet-stream',
      'cache-control': 'public, max-age=3600',
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}
