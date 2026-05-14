import "dotenv/config";
import { Pool } from "pg";

async function listDatabases() {
  // Connect to default postgres database first
  const pool = new Pool({
    host: "ep-long-glitter-ao3sjoyu-pooler.c-2.ap-southeast-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password: "npg_2ziHMPwZCet9",
    database: "postgres",
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;");
    console.log("✅ Available databases:");
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.datname}`);
    });
    await pool.end();
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  }
}

listDatabases();
