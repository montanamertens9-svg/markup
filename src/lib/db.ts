import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'db.json');

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

interface DB {
  reviews: Review[];
  comments: Comment[];
}

async function read(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { reviews: parsed.reviews || [], comments: parsed.comments || [] };
  } catch {
    return { reviews: [], comments: [] };
  }
}

async function write(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

function sid(): string {
  return crypto.randomBytes(6).toString('hex');
}

export async function createReview(url: string): Promise<Review> {
  const db = await read();
  const review: Review = { id: sid(), url, createdAt: Date.now() };
  db.reviews.push(review);
  await write(db);
  return review;
}

export async function getReview(id: string): Promise<Review | null> {
  const db = await read();
  return db.reviews.find((r) => r.id === id) || null;
}

export async function listComments(reviewId: string, pageUrl?: string): Promise<Comment[]> {
  const db = await read();
  return db.comments.filter(
    (c) => c.reviewId === reviewId && (!pageUrl || c.pageUrl === pageUrl)
  );
}

export async function addComment(
  c: Omit<Comment, 'id' | 'createdAt' | 'resolved'>
): Promise<Comment> {
  const db = await read();
  const comment: Comment = { ...c, id: sid(), resolved: false, createdAt: Date.now() };
  db.comments.push(comment);
  await write(db);
  return comment;
}

export async function updateComment(
  id: string,
  patch: Partial<Pick<Comment, 'resolved' | 'text'>>
): Promise<Comment | null> {
  const db = await read();
  const c = db.comments.find((x) => x.id === id);
  if (!c) return null;
  Object.assign(c, patch);
  await write(db);
  return c;
}

export async function deleteComment(id: string): Promise<boolean> {
  const db = await read();
  const i = db.comments.findIndex((x) => x.id === id);
  if (i === -1) return false;
  db.comments.splice(i, 1);
  await write(db);
  return true;
}
