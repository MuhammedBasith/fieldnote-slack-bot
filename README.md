# Fieldnote

A Slack bot that observes founder conversations, extracts meaningful insights, and generates draft LinkedIn and X posts.

## What it does

- Listens to Slack channels for meaningful discussions
- Extracts 1-3 actionable insights using LLM
- Generates both X (280 chars) and LinkedIn drafts
- Sends via Slack DM for review and editing
- Learns your writing style over time

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- Supabase account (PostgreSQL)
- OpenAI API key
- Slack workspace with app configured

### Environment Variables

Create a `.env` file:

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL_IDS=C123456,C789012
SLACK_PRIMARY_USER_ID=U123456

# OpenAI
OPENAI_API_KEY=sk-...

# Optional
DEFAULT_TIMEZONE=America/Los_Angeles
```

### Database Setup

Run the migrations in Supabase SQL editor:

```bash
# 1. Initial schema
src/db/migrations/001_initial_schema.sql

# 2. Digest runs tracking
src/db/migrations/002_digest_runs.sql
```

### Slack App Configuration

1. Create app at [api.slack.com/apps](https://api.slack.com/apps)

2. Enable Socket Mode (Settings > Socket Mode)

3. Add Bot Token Scopes (OAuth & Permissions):
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `commands`
   - `users:read`

4. Enable Events (Event Subscriptions):
   - `message.channels`

5. Add Slash Command:
   - Command: `/fieldnote`
   - Description: Generate insights from conversations
   - Usage hint: `[style]`

6. Install to workspace and copy tokens

### Install & Run

```bash
bun install
bun run src/index.ts
```

## Usage

### Generate Insights

Type `/fieldnote` in any Slack channel to analyze recent conversations and receive a DM with insights and draft posts.

### Learn Your Style

Type `/fieldnote style` to open a modal where you can paste 1-3 sample posts. The bot will analyze your writing style and use it for future post generation.

### View & Edit Posts

When you receive the digest DM:
1. Click **X** or **LinkedIn** to view the full post
2. Click **Edit** to modify the content
3. Click **Save** to update

## Architecture

```
src/
├── index.ts                 # Entry point (Express + Slack Bolt)
├── config/env.ts            # Environment validation (Zod)
├── db/
│   ├── client.ts            # Supabase client
│   ├── schema.ts            # TypeScript types
│   └── migrations/          # SQL schemas
├── llm/
│   ├── client.ts            # OpenAI wrapper
│   └── prompts.ts           # Insight & post prompts
├── services/
│   ├── insightService.ts    # Insight extraction & storage
│   ├── postService.ts       # Post generation & storage
│   ├── profileService.ts    # User profile management
│   ├── slackHistoryService.ts  # Fetch Slack messages
│   ├── notificationService.ts  # Send Slack DMs
│   └── digestRunService.ts  # Track digest runs
├── slack/
│   ├── app.ts               # Slack Bolt setup
│   ├── events/              # Message listeners
│   ├── commands/            # Slash commands
│   └── actions/             # Button & modal handlers
└── jobs/
    └── fieldnoteDigest.ts   # Main pipeline
```

## Tech Stack

- **Runtime**: Bun
- **Server**: Slack Bolt (Socket Mode) + Express
- **Database**: Supabase (PostgreSQL)
- **LLM**: OpenAI (gpt-4o-mini)
- **Validation**: Zod

## Data Flow

```
Slack Channel
     ↓
slackHistoryService (fetch messages)
     ↓
insightService (LLM extracts insights)
     ↓
postService (LLM generates X + LinkedIn posts)
     ↓
notificationService (send DM with buttons)
     ↓
User edits in modal → postService.updatePostContent()
```

## License

MIT
