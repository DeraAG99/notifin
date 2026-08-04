import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
