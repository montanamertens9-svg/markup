import { NextRequest } from 'next/server';
import { getReview } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const review = await getReview(params.id);
  if (!review) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(review);
}
