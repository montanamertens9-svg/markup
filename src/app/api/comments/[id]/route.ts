import { NextRequest } from 'next/server';
import { updateComment, deleteComment } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  const patch: { resolved?: boolean; text?: string } = {};
  if (typeof b?.resolved === 'boolean') patch.resolved = b.resolved;
  if (typeof b?.text === 'string') patch.text = b.text;
  const c = await updateComment(params.id, patch);
  return c ? Response.json(c) : Response.json({ error: 'not found' }, { status: 404 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ok = await deleteComment(params.id);
  return Response.json({ ok });
}
