# ClickUp Weekly Report

Automatically generates a formatted weekly report from ClickUp and drops it into Google Sheets. Runs every Monday via AWS Lambda, or manually whenever you want.

## What it does

Pulls all tasks and time tracking data from your ClickUp workspace for the current week (Mon–Sun UTC), then writes a clean, formatted spreadsheet with:

- Tasks grouped by project/list with collapsible sections
- Hyperlinked task names (click to open in ClickUp)
- Status colors (amber = Todo, blue = In Progress, green = Done)
- Hours logged per task
- Summary section per user with task counts and total hours
- Empty Cost/Hr and Total Cost columns for manual entry

## Setup

### You'll need

- Node.js 18+
- A ClickUp API token (Settings → Apps → API Token)
- Your ClickUp team ID (from the URL: `app.clickup.com/t/TEAM_ID/...`)
- A Google Cloud service account with Sheets API enabled
- A Google Spreadsheet (share it with the service account email as Editor)

### Install

```bash
git clone <your-repo>
cd clickup-report
cp .env.example .env
npm install
```

Fill in your `.env`:

```
CLICKUP_TOKEN=pk_your_token_here
CLICKUP_TEAM_ID=123456789
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
```

**Note:** `GOOGLE_SERVICE_ACCOUNT_KEY` must be the entire JSON object on a single line.

### Run it

```bash
node src/index.js
```

Check your Google Sheet — a new tab named "Week of YYYY-MM-DD" will appear with the report.

## Deploy to AWS Lambda

The app runs as a Lambda function every Monday at 8:00 UTC.

```bash
# One-time setup
npm install -g serverless

# Set env vars (Linux/Mac)
export CLICKUP_TOKEN="pk_..."
export CLICKUP_TEAM_ID="123456789"
export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
export GOOGLE_SPREADSHEET_ID="your_id"

# Deploy
npm run deploy        # dev
npm run deploy:prod   # production

# Test
npm run invoke        # run it remotely
npm run logs          # check CloudWatch logs
```

Lambda free tier covers this easily — it runs ~4 times/month.

## Report layout

```
┌─────────────────┬──────────────┬─────────┬──────────┬────────────┬─────────────┬──────────┐
│ Task            │ List/Project │ Project │ Assignee │ Status     │ Hours Logged│ Due Date │
├─────────────────┼──────────────┼─────────┼──────────┼────────────┼─────────────┼──────────┤
│ Design Homepage │ Design       │ Main    │ Alice    │ In Progress│ 1.0         │ Sep 10   │
│ Build API       │ Backend      │ Main    │ Alice    │ Todo       │ 2.5         │          │
│ Build API       │ Backend      │ Main    │ Bob      │ Todo       │ 2.5         │          │
└─────────────────┴──────────────┴─────────┴──────────┴────────────┴─────────────┴──────────┘

┌────────────────────┬─────────────────────┬──────┬────────────┬──────┬────────────┬────────┬─────────┬───────────┬─────────┐
│ SUMMARY BY USER    │                     │      │ Todo       │ In Progress │ Done │ Total Hours│ Cost/Hr │ Total Cost│ Projects│
├────────────────────┼─────────────────────┼──────┼────────────┼──────┼────────────┼────────┼─────────┼───────────┼─────────┤
│ Alice              │ alice@example.com   │      │ 2          │ 1    │ 1          │ 4.5    │         │           │ Main    │
│ Bob                │ bob@example.com     │      │ 1          │ 0    │ 1          │ 3.5    │         │           │ Main    │
└────────────────────┴─────────────────────┴──────┴────────────┴──────┴────────────┴────────┴─────────┴───────────┴─────────┘
```

- **Cost/Hr** and **Total Cost** are empty on purpose — fill them in manually
- Tasks assigned to multiple users get separate rows per assignee
- Unassigned tasks are excluded

## Project structure

```
src/
├── index.js              # Main pipeline (run this)
├── handler.js            # Lambda entry point
├── config.js             # Env var loading
├── clickup/
│   ├── client.js         # Axios with retry + read-only guard
│   ├── projects.js       # Spaces → Folders → Lists
│   ├── tasks.js          # Task fetching
│   ├── timeEntries.js    # Time tracking
│   └── pagination.js     # Generic paginated fetcher
├── sheets/
│   ├── client.js         # Google auth
│   ├── writer.js         # Report formatting (the big one)
│   └── reorder.js        # Move tab to first position
├── transform/
│   └── aggregate.js      # Data transformation
└── utils/
    └── sleep.js          # Shared sleep utility

tests/
├── test-multi-user.js          # Unit tests for multi-assignee logic
├── test-multi-user-sheet.js    # Writes multi-user data to test tab
├── test-sheets-write.js        # Writes dummy data to test tab
├── perf-test.js                # Step timing measurements
└── perf-test-instrumented.js   # HTTP request logging
```

## Running tests

```bash
node tests/test-multi-user.js          # unit tests (no API calls)
node tests/test-multi-user-sheet.js    # writes to "TEST - Multi-User" tab
node tests/test-sheets-write.js        # writes to "TEST - Delete Me" tab
```

## Customization

**Add a column:** Edit `src/sheets/writer.js` — update `COL_COUNT`, header row, task row data, and column widths. If you need data from ClickUp, add it to the task object in `src/transform/aggregate.js`.

**Change status colors:** Edit the `statusTextColors` object in `writer.js`.

**Change the week range:** Edit `getCurrentWeekRange()` in `src/clickup/timeEntries.js`.

**Filter out completed tasks:** Add a `.filter()` in `flattenTasksForReport()` in `aggregate.js`.

## Known issues

- Sequential task fetching — slow for large workspaces (could add concurrency)
- ClickUp row groups expand by default — no API way to collapse them
- `estimateMs` is computed in aggregate.js but never used in the report output
- No CI/CD — GitHub Actions workflow is a stub

## ClickUp API notes

- Read-only — the app never writes to ClickUp (safety interceptor blocks non-GET requests)
- Rate limits handled automatically (retries on 429, exponential backoff on 5xx)
- Status categorization is heuristic-based — custom statuses might not map perfectly

---

Built by a dev who got tired of manually compiling weekly reports. If it breaks, check the `.env` first.
