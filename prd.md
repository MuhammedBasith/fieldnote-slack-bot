# PRD — Conversation-to-Content Slack Agent

## 1. Overview

Founders spend all day discussing product decisions, growth ideas, hiring lessons, and customer insights in Slack.

These conversations already contain high-quality content — but converting them into LinkedIn/X posts requires time and reflection.

This product is a Slack agent that:

* Passively observes founder conversations
* Extracts real insights
* Converts them into authentic draft posts
* Delivers them once per day
* Leaves final control entirely to the founder

No auto-posting.
No dashboards.
Slack is the interface.

---

## 2. Goals

### Primary Goal

Turn real founder conversations into publish-ready LinkedIn and X drafts with near-zero effort.

---

### Secondary Goals

* Match founder’s personal writing style
* Avoid noise and low-signal content
* Learn from founder edits over time
* Respect workflow (no interruptions)

---

## 3. Non-Goals (for MVP)

Explicitly out of scope:

* Auto posting
* Web dashboard
* Analytics
* Multi-workspace support
* Team management
* Content scheduling

These reduce speed and increase surface area without improving core value.

---

## 4. Target User

Early-stage founders who:

* Spend most working hours in Slack
* Think out loud with co-founders
* Want authentic content without manually writing every post

Primary user receives suggestions via Slack DM.

---

## 5. Core User Experience

### Daily Flow

1. Bot silently listens in a specified Slack channel.
2. Messages are stored throughout the day.
3. At a fixed daily time (default 6pm local):

   * Conversations are analyzed.
   * Up to 3 meaningful insights are extracted.
4. Founder receives one Slack DM with suggested posts.

---

### Example DM

🧠 **Today’s Content Signals**

Found 2 moments worth sharing.

---

**1. Onboarding clarity beats features**

*Why this matters:*
You and Jai realized churn was driven by unclear first-time experience, not missing features.

**X Draft:**
<280 char version>

**LinkedIn Draft:**
Story-style post

Buttons:

* View X
* View LinkedIn
* Ignore

---

**2. Hiring lesson**

…

---

## 6. Functional Requirements

### 6.1 Slack Integration

* Listen to messages in one configured channel
* Send DMs to primary user
* Support interactive buttons

Events:

* message.channels

---

### 6.2 Message Storage

Store raw messages:

```sql
messages:
  id
  channel_id
  user_id
  text
  timestamp
```

No embeddings initially.

---

### 6.3 Daily Analysis Job

Triggered via cron (default 18:00 local).

Steps:

1. Fetch all messages for current day
2. Combine into conversation text
3. Run Insight Extraction
4. If zero insights → no DM
5. Else → generate posts
6. Send Slack DM

---

### 6.4 Insight Extraction (Critical)

LLM prompt:

Purpose: filter signal from noise.

Input:

* Full day conversation

Output (JSON):

```json
[
  {
    "topic": "",
    "core_insight": "",
    "supporting_context": ""
  }
]
```

Rules:

* Max 3 items
* Must be practical or experiential
* Ignore jokes, logistics, greetings
* Must be useful to builders

If empty → stop pipeline.

---

### 6.5 Post Generation

For each insight:

Generate:

* X draft (≤280 chars)
* LinkedIn draft (reflective, story-driven)

Prompt includes:

* Insight
* Original messages
* Founder style profile

Tone rules:

* First person
* Not salesy
* Not hype
* Practical
* Founder voice

---

## 7. Personalization System

### 7.1 Founder Profile Memory

Stored per user:

```sql
user_profile:
  user_id
  writing_tone
  stylistic_rules
  banned_phrases
  interests
```

Injected into every generation prompt.

---

### 7.2 Style Bootstrapping (Optional but high value)

User provides X profile via Slack command:

```
/connect-x https://x.com/username
```

Backend:

* Firecrawl fetches recent posts
* LLM summarizes writing style:

  * tone
  * sentence length
  * structure
  * recurring themes

Saved into user_profile.

---

### 7.3 Learning from Edits (Stretch)

When user edits draft and sends back:

* Compare original vs edited
* Extract deltas
* Update profile:

Examples:

* prefers shorter sentences
* removes emojis
* avoids hashtags

Lightweight reinforcement.

---

## 8. Technical Architecture

### Backend

* Bun Express
* Supabase
* Slack SDK
* Gemini
* APScheduler or cron

---

### Pipeline

Slack → FastAPI → DB → Daily Job → LLM → Slack DM

No frontend.

---

## 9. Key Prompts

### Insight Extractor

System:

```
You are a product-thinking founder.

From this Slack conversation, extract up to 3 insights worth sharing publicly.

Rules:
- Must be practical or experiential
- Ignore jokes and logistics
- Think like a startup founder
- Return JSON only
```

---

### Post Generator

System:

```
You write like this founder.

Founder profile:
{profile}

Write authentic posts based on real conversations.
Avoid hype.
Sound reflective and practical.
First person voice.
```

User:

* topic
* core_insight
* raw context

---

## 10. Data Model

Minimal:

* messages
* user_profile
* daily_insights
* generated_posts

---

## 11. Build Plan

### Day 1

* Slack app
* FastAPI endpoint
* Message ingestion

### Day 2

* Daily cron
* Insight extraction
* Post generation
* Slack DM

### Day 3

* Style ingestion
* Buttons
* Deduplication
* Polish

---

## 13. Future (Not MVP)

* Web dashboard
* Content library
* Search
* Scheduling
* Team support

Explicitly deferred.