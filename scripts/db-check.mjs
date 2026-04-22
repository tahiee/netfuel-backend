import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.CONNECTION_URL;
if (!connectionString) {
  console.error("Missing CONNECTION_URL in environment.");
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  await client.connect();
  const dbInfo = await client.query(
    "select current_database() as db, current_user as usr, version() as version"
  );
  const tableInfo = await client.query(
    "select count(*)::int as total from information_schema.tables where table_schema = 'public'"
  );
  console.log(
    JSON.stringify(
      {
        connectionString,
        db: dbInfo.rows[0].db,
        user: dbInfo.rows[0].usr,
        publicTables: tableInfo.rows[0].total,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("DB check failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
