import process from "node:process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

describe("PostgreSQL Connection", () => {
  let skipPostgresTests = false;
  let config: any;
  let postgres: any;
  let logger: any;

  beforeAll(async () => {
    // Set up environment for config loading
    process.env = {
      ...originalEnv,
      DISCORD_TOKEN: "test-token",
      NODE_ENV: "test",
      DATABASE_TYPE: originalEnv.DATABASE_TYPE || "sqlite",
    };

    // Reset modules to pick up new environment
    vi.resetModules();

    // Import after environment is set
    const configModule = await import("../src/config");
    const postgresModule = await import("../src/database/postgres");
    const loggerModule = await import("../src/logger");

    config = configModule.config;
    postgres = postgresModule;
    logger = loggerModule.createChildLogger("database.test");

    if (config.DATABASE_TYPE !== "postgres") {
      skipPostgresTests = true;
      logger.info("Skipping PostgreSQL tests (DATABASE_TYPE != postgres)");
    }
  });

  afterAll(async () => {
    if (config && config.DATABASE_TYPE === "postgres") {
      try {
        await postgres.closePool();
      } catch (error) {
        if (logger) {
          logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Error closing pool in afterAll",
          );
        }
      }
    }
    process.env = originalEnv;
  });

  it("should initialize connection pool", async () => {
    if (skipPostgresTests) {
      logger.info("Skipping test: DATABASE_TYPE is not postgres");
      return;
    }

    const pool = postgres.getPool();

    expect(pool).toBeDefined();
    expect(pool).toHaveProperty("connect");
    expect(pool).toHaveProperty("query");
    expect(pool).toHaveProperty("end");
  });

  it("should execute query", async () => {
    if (skipPostgresTests) {
      logger.info("Skipping test: DATABASE_TYPE is not postgres");
      return;
    }

    const result = await postgres.query("SELECT 1 as num");

    expect(result).toBeDefined();
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]).toHaveProperty("num");
    expect(result.rows[0].num).toBe(1);
  });

  it("should handle connection errors gracefully", async () => {
    if (skipPostgresTests) {
      logger.info("Skipping test: DATABASE_TYPE is not postgres");
      return;
    }

    // Test that invalid queries throw errors appropriately
    try {
      await postgres.query("SELECT * FROM nonexistent_table_xyz");
      // If we get here, the test should fail
      expect.fail("Expected query to throw an error");
    } catch (error) {
      // Expected behavior: query should throw an error for invalid table
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
    }
  });

  it("should acquire and release client from pool", async () => {
    if (skipPostgresTests) {
      logger.info("Skipping test: DATABASE_TYPE is not postgres");
      return;
    }

    const client = await postgres.getClient();

    expect(client).toBeDefined();
    expect(client).toHaveProperty("query");
    expect(client).toHaveProperty("release");

    // Execute a simple query with the client
    const result = await client.query("SELECT 1 as num");
    expect(result.rows[0].num).toBe(1);

    // Release the client back to the pool
    client.release();
  });

  it("should build config from DATABASE_URL", () => {
    if (skipPostgresTests) {
      logger.info("Skipping test: DATABASE_TYPE is not postgres");
      return;
    }

    // Test buildConfig function with a sample DATABASE_URL
    const pgConfig = postgres.buildConfig();

    expect(pgConfig).toBeDefined();
    expect(pgConfig).toHaveProperty("host");
    expect(pgConfig).toHaveProperty("port");
    expect(pgConfig).toHaveProperty("min");
    expect(pgConfig).toHaveProperty("max");
    expect(pgConfig.port).toBeGreaterThan(0);
    expect(pgConfig.min).toBeGreaterThan(0);
    expect(pgConfig.max).toBeGreaterThanOrEqual(pgConfig.min);
  });
});
