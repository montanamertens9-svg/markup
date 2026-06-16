import { NextRequest } from 'next/server';
import { createReview } from '@/lib/db';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  const url = body?.url;
  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'url required' }, { status: 400 });
  }
  let norm = url.trim();
  if (!/^https?:\/\//i.test(norm)) norm = 'https://' + norm;
  try {
    new URL(norm);
  } catch {
    return Response.json({ error: 'invalid url' }, { status: 400 });
  }
  const review = await createReview(norm);
  return Response.json(review);
}
