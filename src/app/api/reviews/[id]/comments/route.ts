import { NextRequest } from 'next/server';
import { listComments, addComment } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const pageUrl = req.nextUrl.searchParams.get('pageUrl') || undefined;
  const comments = await listComments(params.id, pageUrl);
  return Response.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!b?.text || typeof b.text !== 'string') {
    return Response.json({ error: 'text required' }, { status: 400 });
  }
  const c = await addComment({
    reviewId: params.id,
    pageUrl: typeof b.pageUrl === 'string' ? b.pageUrl : '',
    selector: typeof b.selector === 'string' ? b.selector : 'body',
    fx: Number(b.fx) || 0,
    fy: Number(b.fy) || 0,
    pageX: Number(b.pageX) || 0,
    pageY: Number(b.pageY) || 0,
    text: b.text,
    author: typeof b.author === 'string' && b.author ? b.author : 'Anonymous',
  });
  return Response.json(c);
}
