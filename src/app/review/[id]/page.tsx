'use client';

import { useEffect, useState } from 'react';

export default function ReviewPage({ params }: { params: { id: string } }) {
  const [reviewUrl, setReviewUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/reviews/' + params.id)
      .then((r) => r.json())
      .then((d) => d?.url && setReviewUrl(d.url))
      .catch(() => {});
  }, [params.id]);

  function copy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 14px',
          background: '#111827',
          color: '#fff',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
          💬 Markup
        </a>
        <div
          style={{
            flex: 1,
            background: '#0b1220',
            border: '1px solid #1f2937',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 13,
            color: '#94a3b8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {reviewUrl || 'Loading…'}
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          Toggle the 💬 button in the page to start commenting →
        </span>
        <button
          onClick={copy}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: 'none',
            background: copied ? '#22c55e' : '#6366f1',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy share link'}
        </button>
      </header>
      <iframe
        src={'/api/proxy/' + params.id}
        title="review"
        style={{ flex: 1, width: '100%', border: 'none' }}
      />
    </div>
  );
}
