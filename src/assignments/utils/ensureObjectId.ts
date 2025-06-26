import { Types } from 'mongoose';

export function ensureObjectId(id: unknown): Types.ObjectId {
  if (id instanceof Types.ObjectId) return id;
  return new Types.ObjectId(id as string);
}
