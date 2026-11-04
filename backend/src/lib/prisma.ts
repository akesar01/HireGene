import { PrismaClient } from "@prisma/client";
import { resolveDatasourceUrl } from "./db-url.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const { url, warnings } = resolveDatasourceUrl(process.env.DATABASE_URL);
  for (const warning of warnings) console.warn(`[Prisma] ${warning}`);
  return new PrismaClient({
    log: ["error", "warn"],
    ...(url ? { datasourceUrl: url } : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
