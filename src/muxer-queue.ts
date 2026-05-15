import { and, asc, eq, lt, sql } from "drizzle-orm";
import {
  getDatabase as getDrizzleDatabase,
  initializeDatabase,
} from "./database/drizzle";
import { muxerJobsTable, uiStateTable } from "./database/schema";
import { createChildLogger } from "./logger";

const logger = createChildLogger("muxer-queue");

interface QueryBuilder<T = unknown> extends PromiseLike<T> {
  from(...args: unknown[]): QueryBuilder<T>;
  where(...args: unknown[]): QueryBuilder<T>;
  orderBy(...args: unknown[]): QueryBuilder<T>;
  limit(...args: unknown[]): QueryBuilder<T>;
  values(...args: unknown[]): QueryBuilder<T>;
  onConflictDoNothing(...args: unknown[]): QueryBuilder<T>;
  onConflictDoUpdate(...args: unknown[]): QueryBuilder<T>;
  set(...args: unknown[]): QueryBuilder<T>;
  groupBy(...args: unknown[]): QueryBuilder<T>;
}

export interface SqliteDatabase {
  select<T = unknown[]>(...args: unknown[]): QueryBuilder<T>;
  insert(...args: unknown[]): QueryBuilder<unknown>;
  update(...args: unknown[]): QueryBuilder<unknown>;
  delete(...args: unknown[]): QueryBuilder<unknown>;
}

function db(): SqliteDatabase {
  return getDrizzleDatabase() as unknown as SqliteDatabase;
}

export interface MuxerJobData {
  userId: string;
  sessionId: string;
  recordingsDir: string;
  outputDir: string;
}

interface StoredJobRow {
  id: string;
  data: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  error: string | null;
}

interface JobStatsRow {
  status: "pending" | "processing" | "completed" | "failed";
  count: number | string | { count: number | string };
}

interface StoredJob {
  id: string;
  data: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

// Export getDatabase for backward compatibility with webserver.ts
export function getDatabase(): SqliteDatabase {
  return db();
}

export async function getPersistedValue<T>(
  key: string,
  fallback: T,
): Promise<T> {
  await initializeDatabase();
  const database = db();

  const row = await database
    .select<Array<{ value: string }>>()
    .from(uiStateTable)
    .where(eq(uiStateTable.key, key))
    .limit(1);

  if (!row || row.length === 0) return fallback;

  try {
    return JSON.parse(row[0].value) as T;
  } catch {
    return fallback;
  }
}

export async function setPersistedValue(
  key: string,
  value: unknown,
): Promise<void> {
  await initializeDatabase();
  const database = db();

  await database
    .insert(uiStateTable)
    .values({
      key,
      value: JSON.stringify(value),
      updated_at: Date.now(),
    })
    .onConflictDoUpdate({
      target: uiStateTable.key,
      set: {
        value: JSON.stringify(value),
        updated_at: Date.now(),
      },
    });
}

export async function enqueueMuxerJob(data: MuxerJobData): Promise<string> {
  try {
    await initializeDatabase();
    const database = db();

    const jobId = `${data.userId}-${data.sessionId}`;
    const now = Date.now();

    await database
      .insert(muxerJobsTable)
      .values({
        id: jobId,
        data: JSON.stringify(data),
        status: "pending",
        attempts: 0,
        maxAttempts: 3,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    logger.info(
      { jobId, userId: data.userId, sessionId: data.sessionId },
      "Muxer job enqueued",
    );

    return jobId;
  } catch (error) {
    logger.error(
      {
        userId: data.userId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to enqueue muxer job",
    );
    throw error;
  }
}

export async function getPendingJobs(): Promise<StoredJob[]> {
  await initializeDatabase();
  const database = db();

  const rows = await database
    .select<StoredJobRow[]>()
    .from(muxerJobsTable)
    .where(eq(muxerJobsTable.status, "pending"))
    .orderBy(asc(muxerJobsTable.createdAt))
    .limit(10);

  return rows.map((row) => ({
    id: row.id,
    data: row.data,
    status: row.status as "pending" | "processing" | "completed" | "failed",
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    error: row.error || undefined,
  }));
}

export async function updateJobStatus(
  jobId: string,
  status: "processing" | "completed" | "failed",
  error?: string,
): Promise<void> {
  await initializeDatabase();
  const database = db();
  const now = Date.now();

  if (status === "failed") {
    await database
      .update(muxerJobsTable)
      .set({
        status,
        attempts: sql`${muxerJobsTable.attempts} + 1`,
        updatedAt: now,
        error: error || null,
      })
      .where(eq(muxerJobsTable.id, jobId));
  } else {
    await database
      .update(muxerJobsTable)
      .set({
        status,
        updatedAt: now,
      })
      .where(eq(muxerJobsTable.id, jobId));
  }

  logger.info({ jobId, status, error }, "Job status updated");
}

export async function retryFailedJob(jobId: string): Promise<boolean> {
  await initializeDatabase();
  const database = db();

  const jobs = await database
    .select<StoredJobRow[]>()
    .from(muxerJobsTable)
    .where(eq(muxerJobsTable.id, jobId))
    .limit(1);

  const job = jobs[0];

  if (!job) {
    logger.warn({ jobId }, "Job not found");
    return false;
  }

  if (job.attempts >= job.maxAttempts) {
    logger.warn(
      { jobId, attempts: job.attempts, maxAttempts: job.maxAttempts },
      "Max retry attempts reached",
    );
    return false;
  }

  await database
    .update(muxerJobsTable)
    .set({
      status: "pending",
      updatedAt: Date.now(),
    })
    .where(eq(muxerJobsTable.id, jobId));

  logger.info({ jobId, attempt: job.attempts + 1 }, "Job retried");

  return true;
}

export async function cleanupCompletedJobs(
  olderThanMs: number = 24 * 60 * 60 * 1000,
): Promise<number> {
  await initializeDatabase();
  const database = db();
  const cutoffTime = Date.now() - olderThanMs;

  const result = await database
    .delete(muxerJobsTable)
    .where(
      and(
        eq(muxerJobsTable.status, "completed"),
        lt(muxerJobsTable.updatedAt, cutoffTime),
      ),
    );

  const deletedCount =
    typeof result === "object" && result !== null && "rowsAffected" in result
      ? Number(result.rowsAffected)
      : 0;

  logger.info({ deletedCount }, "Cleaned up completed jobs");

  return deletedCount;
}

export async function getJobStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  await initializeDatabase();
  const database = db();

  const rows = await database
    .select<JobStatsRow[]>({
      status: muxerJobsTable.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(muxerJobsTable)
    .groupBy(muxerJobsTable.status);

  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of rows) {
    const count =
      typeof row.count === "object" && "count" in row.count
        ? Number((row.count as { count: number | string }).count)
        : Number(row.count);
    if (row.status === "pending") stats.pending = count;
    else if (row.status === "processing") stats.processing = count;
    else if (row.status === "completed") stats.completed = count;
    else if (row.status === "failed") stats.failed = count;
  }

  return stats;
}

export async function closeQueue(): Promise<void> {
  logger.info("Muxer queue closed");
}
