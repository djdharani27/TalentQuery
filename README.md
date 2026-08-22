# Scrape Verse

A self-healing company careers scraper web app built with Next.js and Bright Data.

Enter any company name, and the system automatically discovers their careers page, creates a scraper, extracts job listings, and repairs itself when the page structure changes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js Client)                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Search   │  │ Job List │  │ Admin    │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
├───────┼──────────────┼────────────┼─────────────────────────────┤
│  API Routes (Next.js App Router)                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ /search  │  │ /scrape  │  │ /status  │  │ /heal    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
├───────┼──────────────┼────────────┼──────────────┼──────────────┤
│  Business Logic Layer                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Discovery│  │ Registry │  │ Health   │  │ Normalize│       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              Orchestrator                             │      │
│  │  scrape → validate → heal → retry → save             │      │
│  └────────────────────────┬─────────────────────────────┘      │
├───────────────────────────┼─────────────────────────────────────┤
│  External Services        │                                     │
│  ┌────────────────────────▼─────────────────────────────┐      │
│  │           Bright Data API Client                      │      │
│  │  /dca/trigger  /dca/dataset  /dca/collector           │      │
│  │  /dca/collectors/{id}/automate_template               │      │
│  │  /dca/collectors/{id}/refactor_template               │      │
│  └───────────────────────────────────────────────────────┘      │
│  ┌───────────────────────────────────────────────────────┐      │
│  │           Supabase (Postgres)                         │      │
│  │  companies | jobs | scraper_runs | healing_runs       │      │
│  └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Company Discovery
When you enter a company name, the system:
- Normalizes the name and guesses the domain (e.g., "Cursor" → cursor.com)
- Probes common careers paths (/careers, /jobs, /about/careers, etc.)
- Falls back to scanning the homepage for careers links
- Tries alternative domains (.io, .co, get*.com) if needed

### 2. Scraper Registry
Each company gets its own Bright Data scraper (collector). On first request:
- A scraper template is created via `POST /dca/collector`
- AI Flow generates the scraper code via `POST /dca/collectors/{id}/automate_template`
- The scraper ID is saved in the database for future reuse

### 3. Scraper Execution
The orchestrator runs the scraper via Bright Data's Collection API:
- `POST /dca/trigger` queues the job
- `GET /dca/dataset` polls for results
- Raw results are normalized into a standard job schema

### 4. Health Scoring
Every scrape result is evaluated with 9 weighted checks:

| Check | Weight | What it measures |
|-------|--------|-----------------|
| Request succeeded | 15 | Did Bright Data return data? |
| Valid content | 10 | Is there actual content? |
| Expected format | 10 | Are results objects? |
| Has jobs | 20 | Were any jobs found? |
| Jobs have titles | 10 | Do jobs have title fields? |
| Jobs have URLs | 10 | Do jobs have links? |
| URLs valid | 5 | Are the URLs well-formed? |
| Count not collapsed | 15 | Did count drop >90% from previous? |
| Schema similarity | 5 | Is the structure consistent? |

Score thresholds:
- **90-100**: Healthy
- **70-89**: Suspicious
- **0-69**: Broken (triggers self-healing)

### 5. Self-Healing
When a scraper is broken:
1. The system triggers Bright Data's Self-Healing API (`POST /dca/collectors/{id}/refactor_template`)
2. A detailed prompt is sent with: target URL, expected schema, previous job count, failed checks, and sample broken output
3. The system polls for completion (`GET /dca/collectors/{id}/automate_template/progress`)
4. If the AI proposes changes (`pending_answer`), they are auto-approved
5. After healing completes, the scraper is re-tested
6. If the re-test passes, the new version is activated
7. Maximum 2 healing attempts per company

### 6. Job Persistence
- Jobs are upserted by company + external_id (base64 of URL)
- Jobs not seen for 24+ hours are marked inactive
- Historical data is preserved for trend analysis

## Setup

### Prerequisites
- Node.js 18+
- A Bright Data account with API token
- A Supabase project (or any Postgres database)

### Environment Variables

```bash
# Bright Data
BRIGHTDATA_API_TOKEN=your_api_token_here
BRIGHTDATA_COLLECTOR_ID=c_mt4by8ou1i9fn84o32

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Database Setup

1. Go to your Supabase project's SQL Editor
2. Run the contents of `src/lib/db/schema.sql`
3. This creates the 4 tables with indexes and triggers

### Install & Run

```bash
npm install --include=dev
npm run dev
```

Open http://localhost:3000

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/companies/search` | Discover and register a company |
| POST | `/api/companies/[id]/scrape` | Run scraper (with auto-healing) |
| GET | `/api/companies/[id]/jobs` | Get normalized job listings |
| GET | `/api/companies/[id]/status` | Get company health and history |
| POST | `/api/companies/[id]/heal` | Manually trigger self-healing |
| GET | `/api/dev/test-scenarios` | Run simulated test scenarios |

## Testing Self-Healing

The app includes 5 test scenarios accessible at `/api/dev/test-scenarios`:

| Scenario | Description | Expected Health |
|----------|-------------|-----------------|
| `success` | 100 valid jobs | Healthy (100) |
| `zero_jobs` | Empty result | Broken (35) |
| `malformed` | Non-object data | Broken (25) |
| `missing_fields` | Jobs without titles | Broken/Suspicious |
| `healed` | 120 jobs after healing | Healthy (100) |

Run from the Admin page UI or directly:
```bash
curl http://localhost:3000/api/dev/test-scenarios?scenario=success
```

## Bright Data API Endpoints Used

| Endpoint | Purpose | Docs |
|----------|---------|------|
| `POST /dca/collector` | Create scraper template | [Create Scraper Template](https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/create-scraper-template) |
| `POST /dca/collectors/{id}/automate_template` | Generate scraper code with AI | [Trigger AI Flow](https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/trigger-ai-flow) |
| `GET /dca/collectors/{id}/automate_template/progress` | Poll AI job status | [AI Job Progress](https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/ai-job-progress) |
| `POST /dca/collectors/{id}/refactor_template` | Trigger self-healing | [Trigger Self-Healing](https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/trigger-self-healing) |
| `POST /dca/trigger` | Run scraper collection | [Trigger Collection](https://docs.brightdata.com/datasets/scraper-studio/quickstart) |
| `GET /dca/dataset` | Fetch collection results | [Get Results](https://docs.brightdata.com/datasets/scraper-studio/quickstart) |
| `GET /dca/collectors_list` | List all scrapers | [List Scrapers](https://docs.brightdata.com/api-reference/scraper-studio-api/list-scrapers) |

## Project Structure

```
src/
  app/
    page.tsx              # Main search + jobs UI
    admin/page.tsx        # Admin debug panel
    api/
      companies/
        search/route.ts   # Company discovery
        [id]/
          scrape/route.ts # Trigger scraper
          jobs/route.ts   # Get jobs
          status/route.ts # Get health/status
          heal/route.ts   # Manual healing
      dev/
        test-scenarios/   # Dev-only test endpoints
  lib/
    brightdata/client.ts  # Bright Data API client
    company/discovery.ts  # Domain + careers page discovery
    scraper/
      normalize.ts        # Schema-agnostic job extraction
      health.ts           # 9-check health scoring
      registry.ts         # Company + scraper management
      orchestrator.ts     # Main scrape → validate → heal pipeline
    db/
      supabase.ts         # Supabase client
      schema.sql          # Database schema
    types/index.ts        # Zod schemas + TypeScript types
    env.ts                # Environment variable access
    logger.ts             # Structured logging with secret redaction
```

## Deployment

### Vercel
1. Push to GitHub
2. Import in Vercel
3. Set environment variables
4. Deploy

### Self-Hosted
```bash
npm run build
npm start
```

## Known Limitations

- Company discovery uses simple heuristics (domain guessing + path probing). Complex multi-domain companies may need manual careers URL input.
- Self-healing auto-approves AI-proposed changes. In production, you may want manual approval for critical scrapers.
- The health scoring system uses fixed thresholds. Tune the weights and thresholds based on your specific scraper patterns.
- Bright Data's AI Flow can take up to 15 minutes. The UI polls every 3 seconds during healing.
- Job deduplication uses base64-encoded URLs as external IDs. Jobs without URLs get unique IDs on each scrape.

## License

MIT
