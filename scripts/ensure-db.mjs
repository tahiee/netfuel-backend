import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.CONNECTION_URL;
const databaseName = process.env.DATABASE_NAME;

if (!connectionString || !databaseName) {
  console.error("Missing CONNECTION_URL or DATABASE_NAME in .env");
  process.exit(1);
}

const parsed = new URL(connectionString);
parsed.pathname = "/postgres";

const adminClient = new Client({ connectionString: parsed.toString() });

try {
  await adminClient.connect();
  const existsRes = await adminClient.query(
    "select 1 from pg_database where datname = $1 limit 1",
    [databaseName]
  );

  if (existsRes.rowCount === 0) {
    await adminClient.query(`create database "${databaseName}"`);
    console.log(`Created database: ${databaseName}`);
  } else {
    console.log(`Database already exists: ${databaseName}`);
  }
} catch (error) {
  console.error("Failed to ensure database:", error?.message ?? error);
  process.exit(1);
} finally {
  await adminClient.end().catch(() => undefined);
}
