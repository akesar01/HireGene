import { JOB_EXPIRY_DAYS } from "./config.js";
import { prisma } from "./prisma.js";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** postedAt older than this is expired. */
export function jobExpiryCutoff(now = new Date()): Date {
  return new Date(now.getTime() - JOB_EXPIRY_DAYS * MS_PER_DAY);
}

export function computeExpiresAt(postedAt: Date): Date {
  return new Date(postedAt.getTime() + JOB_EXPIRY_DAYS * MS_PER_DAY);
}

export function isJobExpired(postedAt: Date, now = new Date()): boolean {
  return postedAt.getTime() <= jobExpiryCutoff(now).getTime();
}

export function activeJobWhere(now = new Date()) {
  return { postedAt: { gt: jobExpiryCutoff(now) } };
}

export function expiredJobWhere(now = new Date()) {
  return { postedAt: { lte: jobExpiryCutoff(now) } };
}

export async function purgeExpiredJobs(now = new Date()): Promise<number> {
  const result = await prisma.job.deleteMany({
    where: expiredJobWhere(now),
  });
  return result.count;
}
