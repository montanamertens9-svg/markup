'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.id) router.push('/review/' + data.id);
      else setError(data.error || 'Something went wrong');
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg,#0f172a,#1e293b)',
        color: '#fff',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
        <h1 style={{ fontSize: 34, margin: '0 0 8px' }}>Comment on any live URL</h1>
        <p style={{ color: '#94a3b8', margin: '0 0 28px' }}>
          Paste a link, drop pins anywhere on the page, leave feedback. Share the review link with
          anyone.
        </p>
        <form onSubmit={go} style={{ display: 'flex', gap: 8 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com"
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#fff',
              fontSize: 16,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px 22px',
              borderRadius: 10,
              border: 'none',
              background: '#6366f1',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading…' : 'Start review'}
          </button>
        </form>
        {error && <p style={{ color: '#f87171', marginTop: 14 }}>{error}</p>}
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 24 }}>
          Works best on mostly-static sites. Heavy JS apps, login-gated, and anti-bot pages may not
          render fully through the proxy.
        </p>
      </div>
    </main>
  );
}
