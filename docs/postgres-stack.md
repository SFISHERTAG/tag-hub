# PostgreSQL Stack Consolidation

Replace internal infrastructure (caching, queues, search, logs, vectors) with PostgreSQL extensions and native features. This cuts operational overhead when you're not yet at massive scale.

## Current TAG Architecture
- Firestore (primary data)
- Postgres (migration target for structured data)
- Firebase Functions + app/api (backend)
- Angular frontend (Material Design)
- No existing Redis, RabbitMQ, Elasticsearch, or vector DB

This doc covers how to migrate *to* PostgreSQL-native infrastructure as data grows, without introducing new dependencies.

---

## 1. Background Jobs & Queues

**Problem**: Async work (email sends, webhooks, data sync) needs reliable delivery without spinning up RabbitMQ.

**Solution**: `FOR UPDATE SKIP LOCKED` on a jobs table.

### Schema
```sql
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, done, failed
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX jobs_status_created ON jobs(status, created_at) 
  WHERE status = 'pending';
```

### Worker Pattern
```javascript
// Poll in a background loop
async function processJobs() {
  const job = await db.queryOne(`
    SELECT * FROM jobs 
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);
  
  if (!job) return; // no work
  
  try {
    await db.query('UPDATE jobs SET status = $1, started_at = NOW() WHERE id = $2', 
      ['processing', job.id]);
    await handleJob(job);
    await db.query('UPDATE jobs SET status = $1, completed_at = NOW() WHERE id = $2', 
      ['done', job.id]);
  } catch (err) {
    await db.query(`
      UPDATE jobs 
      SET attempts = attempts + 1, 
          error = $1,
          status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END
      WHERE id = $2
    `, [err.message, job.id]);
  }
}
```

**Capacity**: Thousands of jobs/sec. Multiple workers can run simultaneously; `SKIP LOCKED` prevents contention.

---

## 2. Full-Text Search

**Problem**: Need to search over text fields (contact names, notes, tags) without Elasticsearch.

**Solution**: PostgreSQL `tsvector` + GIN index.

### Schema
```sql
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  tags TEXT[],
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(email, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'C')
  ) STORED
);

CREATE INDEX contacts_search ON contacts USING GIN(search_vector);
```

### Query
```sql
SELECT id, name, email, ts_rank(search_vector, query) AS rank
FROM contacts,
     plainto_tsquery('english', 'tax preparation') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

**Features**:
- Stemming: "running" matches "run"
- Stop-word removal: ignores "the", "and"
- Ranking: weight A (name) > B (email) > C (tags)
- Fuzzy: use `pg_trgm` extension for typo tolerance

### Typo Tolerance (pg_trgm)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX contacts_name_trgm ON contacts USING GIN(name gin_trgm_ops);

-- Typo-tolerant query
SELECT id, name FROM contacts 
WHERE name % 'sam fiser'; -- matches "Sam Fisher" even with typo
```

---

## 3. Caching & Hot Rows

**Problem**: Frequently-read data (user sessions, feature flags, rate limits) needs sub-millisecond latency.

**Solution**: Materialized views + partial indexes + connection pooling.

### Materialized View (Precalculated Aggregates)
```sql
CREATE MATERIALIZED VIEW user_stats AS
SELECT 
  u.id,
  u.email,
  COUNT(c.id) AS contact_count,
  COUNT(DISTINCT c.hat) AS hat_count,
  MAX(c.created_at) AS last_contact_at
FROM users u
LEFT JOIN contacts c ON u.id = c.uid
GROUP BY u.id;

CREATE UNIQUE INDEX user_stats_id ON user_stats(id);

-- Refresh in background without locking reads
REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
```

### Partial Index (Hot Rows)
```sql
-- Only index active sessions, not all past sessions
CREATE INDEX sessions_active ON sessions(uid, token)
WHERE expires_at > NOW();
```

**When to use**: 
- Materialized views for expensive aggregations refreshed on schedule (nightly, hourly)
- Partial indexes for hot subsets (active users, recent logs)
- Connection pooling (PgBouncer) for low-latency connection reuse

---

## 4. Event Logs & Telemetry

**Problem**: High-volume event ingestion (audit logs, page views, API calls) without Datadog/Elastic.

**Solution**: Partitioning + BRIN indexes.

### Schema with Declarative Partitioning
```sql
CREATE TABLE events (
  id BIGSERIAL,
  uid BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Automatically partition by month
CREATE TABLE events_2026_08 PARTITION OF events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE events_2026_09 PARTITION OF events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

### BRIN Index (Block Range Index)
```sql
-- Tiny index for sequential data: only stores min/max per block
CREATE INDEX events_created_at_brin ON events USING BRIN(created_at);

-- Query: scans only disk blocks containing the date range
SELECT * FROM events 
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND uid = 42;
```

**Why BRIN?**: If events are inserted sequentially (normal), BRIN is 100x smaller than B-tree while staying fast.

---

## 5. Vector Embeddings for AI Features

**Problem**: Store embeddings (semantic search, recommendations) without Pine Cone or Weaviate.

**Solution**: `pgvector` extension + HNSW indexes.

### Setup
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id BIGSERIAL PRIMARY KEY,
  uid BIGINT NOT NULL,
  text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI's embedding size
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW: hierarchical small-world graph for fast nearest-neighbor
CREATE INDEX embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops);
```

### Hybrid Search (Semantic + Metadata)
```sql
-- Find documents similar to a query, authored by specific user, recent
SELECT id, text, 1 - (embedding <=> query_embedding) AS similarity
FROM embeddings
WHERE uid = 42
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

**Why this matters**: Unlike separate vector DB + Postgres, you avoid the "hybrid search problem"—filtering by user ID *and* semantic similarity in one atomic query.

---

## 6. Migration Path

### Phase 1: New Features (No Backfill)
Start writing background jobs, search, and logs to PostgreSQL tables. Keep Firestore live for existing data until the feature is confident.

```javascript
// Dual-write during transition
async function createContact(data) {
  const docId = await db.firestore.collection('contacts').add(data);
  await db.postgres.query(
    'INSERT INTO contacts (id, uid, name, email) VALUES ($1, $2, $3, $4)',
    [docId, data.uid, data.name, data.email]
  );
  return docId;
}
```

### Phase 2: Backfill & Cutover
When confident, backfill Postgres from Firestore and flip the read path.

```bash
npm run scripts/backfill-contacts-to-postgres.ts
npm run build && npm run test --watch=false
# Cutover: update app to read from postgres
```

### Phase 3: Archive Firestore
Once Postgres is stable and all reads switched, archive Firestore collections (keep for audit, deprecate for new code).

---

## 7. Operational Checklist

- [ ] Postgres version >= 14 (for declarative partitioning, BRIN performance)
- [ ] Connection pooling: PgBouncer or cloud provider's built-in (Neon, Cloud SQL)
- [ ] Automated backups with point-in-time recovery
- [ ] Monitoring: query performance (pg_stat_statements), table bloat, slow logs
- [ ] Vacuum/analyze schedule (auto-vacuum is usually fine; adjust if needed)
- [ ] Storage: plan partition archival when partitions get old (compress, export, drop)

---

## 8. When NOT to Do This

PostgreSQL scales *vertically* gracefully, but *horizontally* sharding is complex. Don't adopt this consolidation if you need:
- Multi-millisecond response times for millions of concurrent WebSocket connections
- Millions of events per second ingestion
- True horizontal sharding across regions

Until you hit enterprise scale (which TAG is nowhere near), consolidating to Postgres is the right call.

---

## Next Steps

1. **Audit data model**: `docs/data-model.md` reflects both Firestore and Postgres today. Update it to document job queues, search indexes, event partitions.
2. **Add tests**: Write integration tests for queue processing, search accuracy, vector similarity.
3. **Instrument**: Add monitoring for job queue depth, search latency, partition size.
4. **Backfill**: Start with one feature (e.g., contact search) and backfill from Firestore.

