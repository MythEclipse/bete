import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
console.log("Testing connection to:", connectionString?.replace(/:[^:]*@/, ":***@"));

async function testConnection() {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });

  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Connection successful!");
    console.log("✅ Query result:", result.rows[0]);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

testConnection();
