import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
