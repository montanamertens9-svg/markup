import * as cheerio from 'cheerio';

export function proxiedUrl(reviewId: string, abs: string): string {
  return `/api/proxy/${reviewId}?url=${encodeURIComponent(abs)}`;
}

function resolve(ref: string, base: string): string | null {
  try {
    return new URL(ref, base).href;
  } catch {
    return null;
  }
}

const SKIP = /^(data:|javascript:|mailto:|tel:|blob:|#|about:)/i;

export function rewriteCss(css: string, base: string, reviewId: string): string {
  return css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, ref) => {
      if (SKIP.test(ref)) return m;
      const abs = resolve(ref, base);
      if (!abs) return m;
      return `url(${q}${proxiedUrl(reviewId, abs)}${q})`;
    })
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, ref) => {
      if (SKIP.test(ref)) return m;
      const abs = resolve(ref, base);
      if (!abs) return m;
      return `@import ${q}${proxiedUrl(reviewId, abs)}${q}`;
    });
}

function rewriteSrcset(val: string, base: string, reviewId: string): string {
  return val
    .split(',')
    .map((part) => {
      const seg = part.trim();
      if (!seg) return seg;
      const sp = seg.split(/\s+/);
      const url = sp[0];
      if (SKIP.test(url)) return seg;
      const abs = resolve(url, base);
      if (!abs) return seg;
      sp[0] = proxiedUrl(reviewId, abs);
      return sp.join(' ');
    })
    .join(', ');
}

export function rewriteHtml(
  html: string,
  base: string,
  reviewId: string,
  pageUrl: string
): string {
  const $ = cheerio.load(html);

  // Strip things that would block our rewritten/injected resources.
  $('meta[http-equiv="Content-Security-Policy" i]').remove();
  $('meta[http-equiv="content-security-policy" i]').remove();
  $('base').remove();
  $('[integrity]').removeAttr('integrity');
  $('[crossorigin]').removeAttr('crossorigin');

  const urlAttrs = ['href', 'src', 'poster', 'data-src', 'action', 'formaction'];

  $('*').each((_, node) => {
    const el = $(node);
    for (const a of urlAttrs) {
      const v = el.attr(a);
      if (v && !SKIP.test(v)) {
        const abs = resolve(v, base);
        if (abs) el.attr(a, proxiedUrl(reviewId, abs));
      }
    }
    const ss = el.attr('srcset');
    if (ss) el.attr('srcset', rewriteSrcset(ss, base, reviewId));

    const style = el.attr('style');
    if (style && style.includes('url(')) el.attr('style', rewriteCss(style, base, reviewId));
  });

  $('style').each((_, node) => {
    const el = $(node);
    el.text(rewriteCss(el.text(), base, reviewId));
  });

  const config = JSON.stringify({ reviewId, pageUrl });
  const head =
    `<script>window.__MARKUP__=${config};</script>` +
    `<link rel="stylesheet" href="/overlay.css">`;

  if ($('head').length) $('head').prepend(head);
  else $.root().prepend(head);

  if ($('body').length) $('body').append('<script src="/overlay.js" defer></script>');
  else $.root().append('<script src="/overlay.js" defer></script>');

  return $.html();
}
