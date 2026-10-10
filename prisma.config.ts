import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the database URL from this file, not from schema.prisma.
// Local dev: put DATABASE_URL in .env (copy .env.example to .env).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations should use a DIRECT database address (Neon: the one without "-pooler"). The app itself uses DATABASE_URL.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
});
