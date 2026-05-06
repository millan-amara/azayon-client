import { useEffect } from 'react';

// SPA SEO helper — sets document.title, the description meta, the canonical
// link, and the per-page OG/Twitter title+description on mount, then restores
// the previous values on unmount so navigating away doesn't leave stale tags.
//
// We only update tags that already exist in index.html (created/swapped via
// querySelector) — no rendering into <head>, no extra deps.
//
// Usage:
//   <SEO
//     title="Sign in · Azayon"
//     description="Sign in to your Azayon account."
//     canonical="https://app.azayon.com/login"
//     noindex // optional — set true on user-flow pages we don't want indexed
//   />
//
// Note: this runs *after* JS executes. Crawlers that only read static HTML
// see the values from index.html. Google does execute JS, so the per-page
// values do reach the indexer — but for SaaS app pages that's rarely useful.
// The bigger SEO win for this stack is on the marketing site (index-african/).

const APP_BASE = 'https://app.azayon.com';

function setMeta(selector, attr, value) {
  if (!value) return null;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    // Selector looks like `meta[name="description"]` or `meta[property="og:title"]`.
    const match = selector.match(/\[(name|property)="([^"]+)"\]/);
    if (match) el.setAttribute(match[1], match[2]);
    document.head.appendChild(el);
  }
  const previous = el.getAttribute(attr);
  el.setAttribute(attr, value);
  return previous;
}

function setLink(rel, href) {
  if (!href) return null;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  const previous = el.getAttribute('href');
  el.setAttribute('href', href);
  return previous;
}

export default function SEO({ title, description, canonical, noindex = false }) {
  useEffect(() => {
    const restore = [];

    if (title) {
      const prevTitle = document.title;
      document.title = title;
      restore.push(() => { document.title = prevTitle; });

      const prev = setMeta('meta[property="og:title"]', 'content', title);
      restore.push(() => prev != null && setMeta('meta[property="og:title"]', 'content', prev));
      const prevTw = setMeta('meta[name="twitter:title"]', 'content', title);
      restore.push(() => prevTw != null && setMeta('meta[name="twitter:title"]', 'content', prevTw));
    }

    if (description) {
      const prev = setMeta('meta[name="description"]', 'content', description);
      restore.push(() => prev != null && setMeta('meta[name="description"]', 'content', prev));
      const prevOg = setMeta('meta[property="og:description"]', 'content', description);
      restore.push(() => prevOg != null && setMeta('meta[property="og:description"]', 'content', prevOg));
      const prevTw = setMeta('meta[name="twitter:description"]', 'content', description);
      restore.push(() => prevTw != null && setMeta('meta[name="twitter:description"]', 'content', prevTw));
    }

    // Canonical defaults to the current path on app.azayon.com so we don't
    // leave the prior page's canonical pointing at the wrong URL.
    const targetCanonical = canonical || `${APP_BASE}${window.location.pathname}`;
    const prevCanonical = setLink('canonical', targetCanonical);
    restore.push(() => prevCanonical != null && setLink('canonical', prevCanonical));

    // Per-page robots: 'noindex' marks user-flow pages (password reset, etc.)
    // we don't want appearing in search results.
    if (noindex) {
      const prev = setMeta('meta[name="robots"]', 'content', 'noindex, nofollow');
      restore.push(() => prev != null && setMeta('meta[name="robots"]', 'content', prev));
    }

    return () => restore.forEach((fn) => fn());
  }, [title, description, canonical, noindex]);

  return null;
}
