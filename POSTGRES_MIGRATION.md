# PostgreSQL Migration Guide

This guide walks you through migrating your Discord moderation bot from SQLite to PostgreSQL. PostgreSQL provides better performance, scalability, and concurrent access compared to SQLite, making it ideal for production deployments.

## Overview

The migration process involves:
1. Setting up PostgreSQL and creating a database
2. Configuring environment variables
3. Running the automated data migration script
4. Verifying the migration was successful
5. Starting the bot with PostgreSQL

The entire process typically takes 5-10 minutes depending on your data volume.

## Prerequisites

Before starting the migration, ensure you have:

- **PostgreSQL 12 or later** installed and running
  - macOS: `brew install postgresql@15`
  - Ubuntu/Debian: `sudo apt-get install postgresql postgresql-contrib`
  - Windows: Download from https://www.postgresql.org/download/windows/
  - Docker: `docker run -d -e POSTGRES_PASSWORD=password postgres:15`

- **psql command-line tool** (usually included with PostgreSQL)
  - Test with: `psql --version`

- **Sufficient disk space** for your data (at least 2x your current SQLite database size)

- **Network access** to PostgreSQL (if using remote server)

## Step 1: Create PostgreSQL Database and User

Connect to PostgreSQL as the superuser (usually `postgres`):

```bash
psql -U postgres
```

Then run these commands in the psql prompt:

```sql
-- Create the database
CREATE DATABASE discord_bot;

-- Create a dedicated user for the bot
CREATE USER discord_bot WITH PASSWORD 'your_secure_password_here';

-- Grant all privileges on the database to the user
GRANT ALL PRIVILEGES ON DATABASE discord_bot TO discord_bot;

-- Connect to the database and grant schema privileges
\c discord_bot
GRANT ALL PRIVILEGES ON SCHEMA public TO discord_bot;

-- Exit psql
\q
```

**Important:** Replace `'your_secure_password_here'` with a strong password. Store this securely.

### Verify PostgreSQL Connection

Test the connection with your new credentials:

```bash
psql -U discord_bot -d discord_bot -h localhost -W
```

You'll be prompted for the password. If successful, you'll see the `discord_bot=#` prompt. Type `\q` to exit.

## Step 2: Configure Environment Variables

Update your `.env` file with PostgreSQL connection details. You have two options:

### Option A: Using DATABASE_URL (Recommended)

```bash
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://discord_bot:your_secure_password_here@localhost:5432/discord_bot
```

### Option B: Using Individual Parameters

```bash
DATABASE_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=discord_bot
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=discord_bot
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=10
```

### Connection Pool Configuration (Optional)

If you need to tune connection pooling for your workload:

```bash
# Minimum connections to maintain in the pool (default: 2)
POSTGRES_POOL_MIN=2

# Maximum connections allowed in the pool (default: 10)
POSTGRES_POOL_MAX=10
```

**Note:** For most deployments, the defaults are sufficient. Increase `POSTGRES_POOL_MAX` if you see "connection pool exhausted" errors.

### Remote PostgreSQL Server

If using a remote PostgreSQL server (e.g., AWS RDS, Heroku Postgres):

```bash
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@your-server.example.com:5432/discord_bot
```

Or with individual parameters:

```bash
DATABASE_TYPE=postgres
POSTGRES_HOST=your-server.example.com
POSTGRES_PORT=5432
POSTGRES_USER=discord_bot
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=discord_bot
```

## Step 3: Run the Data Migration

Before starting the bot, migrate your existing data from SQLite to PostgreSQL:

```bash
pnpm run migrate:data
```

This script will:
- Read all data from your SQLite database (`.muxer-queue.db`)
- Create PostgreSQL tables if they don't exist
- Insert all messages, attachments, muxer jobs, and UI state
- Handle duplicate records gracefully (skips if already migrated)
- Display a summary of migrated records

**Expected output:**

```
[migrate-data] Starting data migration from SQLite to PostgreSQL
[migrate-data] SQLite database opened
[migrate-data] PostgreSQL connection pool initialized
[migrate-data] Migrating muxer_jobs table...
[migrate-data] Migrated muxer_jobs (count: 42)
[migrate-data] Migrating messages table...
[migrate-data] Migrated messages (count: 1,234)
[migrate-data] Migrating attachments table...
[migrate-data] Migrated attachments (count: 567)
[migrate-data] Migrating ui_state table...
[migrate-data] Migrated ui_state (count: 3)
[migrate-data] Data migration completed successfully
```

### Troubleshooting Migration Errors

**Error: "Connection refused"**
- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check DATABASE_URL or POSTGRES_HOST is correct
- Ensure firewall allows connections to port 5432

**Error: "FATAL: role 'discord_bot' does not exist"**
- Verify the user was created: `psql -U postgres -c "\du"`
- Recreate the user if needed (see Step 1)

**Error: "permission denied for database 'discord_bot'"**
- Verify privileges were granted: `psql -U postgres -d discord_bot -c "\dp"`
- Re-run the GRANT commands from Step 1

**Error: "relation 'messages' does not exist"**
- This is normal on first migration. The script creates tables automatically.
- If it persists, check PostgreSQL logs for errors

## Step 4: Start the Bot with PostgreSQL

Once migration completes successfully, start the bot:

```bash
# Development mode (with auto-restart on file changes)
pnpm run dev

# Production mode
pnpm run start
```

The bot will now use PostgreSQL for all data operations. You should see in the logs:

```
[config] Database type: postgres
[webserver] Connected to PostgreSQL
```

## Step 5: Verify Migration Success

### Check Record Counts

Verify that all data was migrated correctly by comparing record counts:

```bash
# Check messages count
psql -U discord_bot -d discord_bot -c "SELECT COUNT(*) as message_count FROM messages;"

# Check attachments count
psql -U discord_bot -d discord_bot -c "SELECT COUNT(*) as attachment_count FROM attachments;"

# Check muxer jobs count
psql -U discord_bot -d discord_bot -c "SELECT COUNT(*) as job_count FROM muxer_jobs;"
```

Compare these counts with your SQLite database:

```bash
# SQLite counts
sqlite3 .muxer-queue.db "SELECT COUNT(*) as message_count FROM messages;"
sqlite3 .muxer-queue.db "SELECT COUNT(*) as attachment_count FROM attachments;"
sqlite3 .muxer-queue.db "SELECT COUNT(*) as job_count FROM muxer_jobs;"
```

### Check Data Integrity

Verify a sample of messages:

```bash
psql -U discord_bot -d discord_bot -c "
SELECT id, username, content, created_at 
FROM messages 
ORDER BY created_at DESC 
LIMIT 5;
"
```

### Monitor Bot Logs

Watch the bot logs for any errors:

```bash
# If running with pnpm run dev, logs appear in the terminal
# Look for any database-related errors or warnings
```

### Test API Endpoints

If the bot has a web interface, test it:

```bash
# Check health endpoint
curl http://localhost:3000/health

# Check API endpoints
curl http://localhost:3000/api/messages?channel=<channel_id>
```

## Rollback to SQLite

If you need to revert to SQLite for any reason:

### Step 1: Stop the Bot

```bash
# Press Ctrl+C if running in foreground
# Or kill the process if running in background
```

### Step 2: Update Environment Variables

Change your `.env` file:

```bash
DATABASE_TYPE=sqlite
# Comment out or remove PostgreSQL variables
# DATABASE_URL=...
# POSTGRES_HOST=...
```

### Step 3: Restart the Bot

```bash
pnpm run dev
```

The bot will now use SQLite (`.muxer-queue.db`). Your SQLite data remains unchanged and available.

### Step 4: Verify Rollback

Check logs for:

```
[config] Database type: sqlite
```

**Note:** Any data created while using PostgreSQL will not be in SQLite. If you need that data, migrate it back to PostgreSQL or export it from PostgreSQL first.

## Performance Considerations

### Connection Pooling

PostgreSQL uses connection pooling to manage database connections efficiently:

- **POSTGRES_POOL_MIN=2** — Maintains at least 2 idle connections
- **POSTGRES_POOL_MAX=10** — Allows up to 10 concurrent connections

For most deployments, these defaults are optimal. Adjust if you see:
- "Connection pool exhausted" errors → increase POSTGRES_POOL_MAX
- High memory usage → decrease POSTGRES_POOL_MAX

### Indexes

PostgreSQL automatically creates indexes on frequently queried columns:

```sql
-- Messages table indexes
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_guild_id ON messages(guild_id);

-- Attachments table indexes
CREATE INDEX idx_attachments_message_id ON attachments(message_id);
CREATE INDEX idx_attachments_channel_id ON attachments(channel_id);
CREATE INDEX idx_attachments_user_id ON attachments(user_id);
```

These indexes are created automatically during migration. They significantly improve query performance.

### Prepared Statements

All database queries use prepared statements, which:
- Prevent SQL injection attacks
- Improve performance through query plan caching
- Reduce parsing overhead

### Foreign Key Constraints

PostgreSQL enforces referential integrity:

```sql
-- Attachments reference messages
ALTER TABLE attachments 
ADD CONSTRAINT fk_attachments_message_id 
FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
```

This ensures data consistency and prevents orphaned records.

### Query Performance

PostgreSQL typically provides 2-10x better performance than SQLite for:
- Concurrent writes (multiple users sending messages simultaneously)
- Large result sets (querying thousands of messages)
- Complex queries (joins, aggregations)
- Concurrent reads (multiple dashboard users)

### Production Recommendations

For production deployments:

1. **Use a managed PostgreSQL service** (AWS RDS, Google Cloud SQL, Heroku Postgres)
   - Automatic backups
   - High availability
   - Monitoring and alerts

2. **Enable SSL/TLS connections**
   ```bash
   DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
   ```

3. **Set up regular backups**
   ```bash
   # Daily backup
   pg_dump -U discord_bot -d discord_bot > backup_$(date +%Y%m%d).sql
   ```

4. **Monitor connection pool usage**
   ```bash
   psql -U discord_bot -d discord_bot -c "
   SELECT datname, count(*) as connections 
   FROM pg_stat_activity 
   GROUP BY datname;
   "
   ```

5. **Tune POSTGRES_POOL_MAX based on load**
   - Start with default (10)
   - Monitor for "connection pool exhausted" errors
   - Increase if needed, but keep under 20 for most workloads

6. **Enable query logging for slow queries**
   ```sql
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   SELECT pg_reload_conf();
   ```

## Troubleshooting

### Connection Issues

**Problem:** "Connection refused" or "Connection timeout"

**Solutions:**
- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check firewall rules allow port 5432
- Verify DATABASE_URL or POSTGRES_HOST is correct
- Test connection manually: `psql -U discord_bot -d discord_bot -h localhost`

### Authentication Issues

**Problem:** "FATAL: password authentication failed"

**Solutions:**
- Verify password in .env matches the one set in Step 1
- Reset password: `psql -U postgres -c "ALTER USER discord_bot WITH PASSWORD 'new_password';"`
- Check for special characters in password (may need escaping)

### Migration Script Errors

**Problem:** Migration script fails partway through

**Solutions:**
- Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql.log`
- Verify database exists: `psql -U postgres -l | grep discord_bot`
- Check disk space: `df -h`
- Re-run migration (it's safe to run multiple times — duplicates are skipped)

### Performance Issues

**Problem:** Queries are slow after migration

**Solutions:**
- Verify indexes were created: `psql -U discord_bot -d discord_bot -c "\di"`
- Check query plans: `EXPLAIN ANALYZE SELECT ...`
- Monitor connection pool: `psql -U discord_bot -d discord_bot -c "SELECT count(*) FROM pg_stat_activity;"`
- Increase POSTGRES_POOL_MAX if connections are exhausted

### Data Inconsistencies

**Problem:** Some data appears missing after migration

**Solutions:**
- Compare record counts (see Step 5)
- Check for migration errors in logs
- Verify SQLite database wasn't modified during migration
- Re-run migration (safe to run multiple times)

## FAQ

**Q: Will the bot experience downtime during migration?**
A: Yes, briefly. Stop the bot, run the migration script (usually < 1 minute), then restart. Total downtime: 2-5 minutes.

**Q: Can I migrate data while the bot is running?**
A: Not recommended. Stop the bot first to ensure data consistency. The SQLite database may be locked otherwise.

**Q: What if the migration fails halfway?**
A: It's safe to re-run. The script uses `ON CONFLICT DO NOTHING` to skip duplicate records. Fix the error and run again.

**Q: Can I keep both SQLite and PostgreSQL running?**
A: Yes, but only one can be active at a time (controlled by DATABASE_TYPE). Switching between them requires restarting the bot.

**Q: How do I backup my PostgreSQL data?**
A: Use `pg_dump`:
```bash
pg_dump -U discord_bot -d discord_bot > backup.sql
```

**Q: Can I use PostgreSQL on a remote server?**
A: Yes. Set DATABASE_URL or POSTGRES_HOST to the remote server address. Ensure network connectivity and firewall rules allow access.

**Q: What's the performance difference between SQLite and PostgreSQL?**
A: PostgreSQL is typically 2-10x faster for concurrent operations and large datasets. SQLite is simpler for single-user, small-scale deployments.

**Q: Do I need to change any code?**
A: No. The database adapter handles both SQLite and PostgreSQL transparently. Just change the environment variables.

## Next Steps

After successful migration:

1. **Monitor the bot** for 24 hours to ensure stability
2. **Set up automated backups** for PostgreSQL
3. **Configure monitoring and alerts** for database health
4. **Document your PostgreSQL setup** for your team
5. **Consider archiving old SQLite data** after confirming migration success

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review PostgreSQL logs: `tail -f /var/log/postgresql/postgresql.log`
3. Check bot logs for database errors
4. Verify environment variables are set correctly
5. Test PostgreSQL connection manually with psql

For additional help, consult:
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Node.js PostgreSQL client: https://node-postgres.com/
- Project issues: Check the repository issue tracker
