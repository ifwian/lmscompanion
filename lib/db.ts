// Single Prisma client for the whole app.
// Prisma 7 needs a "driver adapter"; we use the standard Postgres one (pg).
// The global variable stops dev-mode hot reload from opening a new connection every save.
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  // A few connections per server instance: many instances run at once on Vercel, and the database allows a limited number.
  const max = Math.min(10, Math.max(1, Number.parseInt(process.env.DB_POOL_MAX ?? "3", 10) || 3));
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}
