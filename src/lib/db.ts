import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

export interface Review {
  id: string;
  url: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  reviewId: string;
  pageUrl: string;
  selector: string;
  fx: number;
  fy: number;
  pageX: number;
  pageY: number;
  text: string;
  author: string;
  resolved: boolean;
  createdAt: number;
}

function sid(): string {
  return crypto.randomBytes(6).toString('hex');
}

/* ---------------------------------------------------------------------------
 * Storage backend selection.
 *
 * On a serverless host (Vercel) the filesystem is read-only, so we use Upstash
 * Redis when its env vars are present. Locally (no env vars) we fall back to a
 * JSON file so `npm run dev` works with zero setup.
 * ------------------------------------------------------------------------- */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) _redis = new Redis({ url: REDIS_URL as string, token: REDIS_TOKEN as string });
  return _redis;
}

const rkReview = (id: string) => `review:${id}`;
const rkComment = (id: string) => `comment:${id}`;
const rkReviewComments = (reviewId: string) => `review:${reviewId}:comments`;

/* ---------------------------- JSON file fallback --------------------------- */

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'db.json');

interface DB {
  reviews: Review[];
  comments: Comment[];
}

async function fileRead(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { reviews: parsed.reviews || [], comments: parsed.comments || [] };
  } catch {
    return { reviews: [], comments: [] };
  }
}

async function fileWrite(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

/* -------------------------------- Public API ------------------------------ */

export async function createReview(url: string): Promise<Review> {
  const review: Review = { id: sid(), url, createdAt: Date.now() };
  if (useRedis) {
    await redis().set(rkReview(review.id), review);
  } else {
    const db = await fileRead();
    db.reviews.push(review);
    await fileWrite(db);
  }
  return review;
}

export async function getReview(id: string): Promise<Review | null> {
  if (useRedis) {
    return (await redis().get<Review>(rkReview(id))) ?? null;
  }
  const db = await fileRead();
  return db.reviews.find((r) => r.id === id) || null;
}

export async function listComments(reviewId: string, pageUrl?: string): Promise<Comment[]> {
  let all: Comment[];
  if (useRedis) {
    const ids = await redis().smembers(rkReviewComments(reviewId));
    if (!ids.length) return [];
    const items = await redis().mget<Comment[]>(...ids.map(rkComment));
    all = items.filter((c): c is Comment => Boolean(c));
  } else {
    const db = await fileRead();
    all = db.comments.filter((c) => c.reviewId === reviewId);
  }
  return all
    .filter((c) => !pageUrl || c.pageUrl === pageUrl)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function addComment(
  c: Omit<Comment, 'id' | 'createdAt' | 'resolved'>
): Promise<Comment> {
  const comment: Comment = { ...c, id: sid(), resolved: false, createdAt: Date.now() };
  if (useRedis) {
    await redis().set(rkComment(comment.id), comment);
    await redis().sadd(rkReviewComments(comment.reviewId), comment.id);
  } else {
    const db = await fileRead();
    db.comments.push(comment);
    await fileWrite(db);
  }
  return comment;
}

export async function updateComment(
  id: string,
  patch: Partial<Pick<Comment, 'resolved' | 'text'>>
): Promise<Comment | null> {
  if (useRedis) {
    const c = await redis().get<Comment>(rkComment(id));
    if (!c) return null;
    Object.assign(c, patch);
    await redis().set(rkComment(id), c);
    return c;
  }
  const db = await fileRead();
  const c = db.comments.find((x) => x.id === id);
  if (!c) return null;
  Object.assign(c, patch);
  await fileWrite(db);
  return c;
}

export async function deleteComment(id: string): Promise<boolean> {
  if (useRedis) {
    const c = await redis().get<Comment>(rkComment(id));
    await redis().del(rkComment(id));
    if (c) await redis().srem(rkReviewComments(c.reviewId), id);
    return true;
  }
  const db = await fileRead();
  const i = db.comments.findIndex((x) => x.id === id);
  if (i === -1) return false;
  db.comments.splice(i, 1);
  await fileWrite(db);
  return true;
}
