# Source-First AI Research and News Implementation Roadmap

> Internal development planning document. This document is for implementation sequencing and engineering alignment. It is not public-facing product copy. Because this repository is public, committed files are publicly visible.

## 1. Current repository foundation

The current fork already has a strong foundation for a source-first AI research/news client:

- Next.js / React application shell.
- AI SDK streaming chat flow.
- Quick and Adaptive modes.
- Tool-loop researcher agent.
- Search providers: Qwant, DuckDuckGo, SearXNG, Tavily, Exa, Brave, Firecrawl, Kagi.
- Feed tool supporting RSS, Atom, RDF/RSS, JSON Feed, and podcast metadata.
- Fetch tool for direct URLs and extraction APIs.
- PostgreSQL chat history through Drizzle.
- Supabase Auth.
- Guest mode.
- Rate limiting for guest, overall chat, and Adaptive mode.
- File upload support through R2/S3-compatible storage.
- Shareable chat/results.
- Feedback table.
- Model selector and provider registry.
- Observability hooks through Langfuse/OpenTelemetry.

The roadmap below assumes we are not building a full search index. We are building a client that coordinates search providers, feeds, files, source metadata, and AI synthesis.

## 2. Implementation principles

### 2.1 Do source and safety infrastructure before flashy UI

Gist-style cards are important, but they should sit on reliable source primitives:

1. normalized source records;
2. source cards;
3. feed-aware retrieval;
4. source click tracking;
5. citation/evidence mapping;
6. then Gist decks.

Building visual cards too early risks creating a pretty interface that still has the same AI-search trust problems.

### 2.2 Preserve current behavior while layering new functionality

Existing Quick/Adaptive behavior should continue working.

Use feature flags where possible:

- `ENABLE_SOURCE_CARDS`
- `ENABLE_GIST_MODE`
- `ENABLE_FEED_RETRIEVAL`
- `ENABLE_CLAIM_VERIFICATION`
- `ENABLE_READING_QUEUE`
- `ENABLE_SOURCE_CLICK_TRACKING`

### 2.3 Prefer additive schema changes

Avoid large destructive migrations early. Add new tables and backfill gradually.

### 2.4 Make retrieval provenance explicit

Every source should know where it came from:

- search provider;
- feed;
- direct URL fetch;
- uploaded file;
- user library;
- map/place provider;
- future connector.

### 2.5 Treat cost and abuse controls as product requirements

Adaptive mode, deep fetching, extraction APIs, and model verification can get expensive. Every phase that increases tool calls should include:

- rate-limit review;
- timeout review;
- retry/backoff review;
- cost metrics;
- fallback behavior;
- user-facing error behavior.

## 3. Phase 0 — Internal docs and terminology

### Goal

Align product and engineering language before implementation.

### Tasks

- Add internal strategy document.
- Add this implementation roadmap.
- Keep public README unchanged until product naming stabilizes.
- Add `.gitignore` support for truly private local docs:
  - `docs/private/`
  - `*.local.md`

### Acceptance criteria

- Internal docs exist under `docs/internal/`.
- Public README is not changed by this phase.
- Future private local notes are ignored if placed under `docs/private/` or named `*.local.md`.

## 4. Phase 1 — Source normalization layer

### Goal

Create a common source model that can represent search results, feed items, fetched pages, files, and future connectors.

### Why first

Source cards, Gist cards, traffic tracking, and citation verification all need a common source object.

### Proposed types

Add a new source normalization module, for example:

```text
lib/sources/normalize-source.ts
lib/sources/source-types.ts
lib/sources/source-ranking.ts
lib/sources/source-metadata.ts
```

Core type:

```ts
export type SourceKind =
  | 'web'
  | 'news'
  | 'feed-item'
  | 'feed'
  | 'forum'
  | 'official-doc'
  | 'academic'
  | 'pdf'
  | 'uploaded-file'
  | 'podcast'
  | 'video'
  | 'image'
  | 'map-place'
  | 'unknown'

export interface NormalizedSource {
  id: string
  kind: SourceKind
  title: string
  url?: string
  canonicalUrl?: string
  domain?: string
  siteName?: string
  author?: string
  publishedAt?: string
  updatedAt?: string
  summary?: string
  snippet?: string
  imageUrl?: string
  faviconUrl?: string
  language?: string
  provider?: string
  retrievalMethod: 'search' | 'feed' | 'fetch' | 'upload' | 'library' | 'map'
  retrievalQuery?: string
  rank?: number
  score?: number
  raw?: unknown
}
```

### Database additions

Add a persisted source table only after the in-memory type is stable:

```text
sources
- id varchar primary key
- chat_id varchar nullable
- user_id varchar nullable
- kind varchar not null
- title text not null
- url text
- canonical_url text
- domain text
- site_name text
- author text
- published_at timestamp nullable
- updated_at timestamp nullable
- summary text
- snippet text
- image_url text
- favicon_url text
- provider text
- retrieval_method varchar not null
- retrieval_query text
- rank integer
- score jsonb or numeric nullable
- raw jsonb nullable
- created_at timestamp not null default now()
```

Indexes:

- `sources_chat_id_idx`
- `sources_user_id_created_at_idx`
- `sources_domain_idx`
- `sources_canonical_url_idx`

### Integration points

- Search tool output normalization.
- Feed tool output normalization.
- Fetch tool output normalization.
- File upload metadata normalization.

### Tests

- normalizes a search result with URL/title/content;
- normalizes a feed item with date/author/site;
- normalizes a direct fetch result;
- handles missing URL safely;
- canonicalizes domains consistently;
- preserves retrieval provider/method.

### Acceptance criteria

- Search/feed/fetch outputs can be converted into `NormalizedSource`.
- No UI changes required yet.
- Existing chat output still works.

## 5. Phase 2 — Source cards on standard search page

### Goal

Make sources visible and actionable near the top of the standard search page.

### UX behavior

On result pages:

1. User asks a query.
2. Retrieval runs as normal.
3. The UI renders a source card rail/grid above or beside the generated answer.
4. User can open, save, inspect, or report a source.
5. Standard answer still appears underneath/nearby.

### Components

Possible component structure:

```text
components/sources/source-card.tsx
components/sources/source-card-list.tsx
components/sources/source-inspector.tsx
components/sources/source-actions.tsx
components/sources/source-metadata-row.tsx
```

### Card fields

Each card should show:

- title;
- site/domain;
- source type;
- date;
- short snippet;
- favicon/image where available;
- “Read original” button;
- “Save” button;
- “Evidence” button if claim mapping exists;
- feedback menu.

### Traffic-forward requirements

- `Read original` must be visually primary.
- Open original in a new tab/window unless app shell has an intentional browser surface.
- Track source-open events.
- Do not hide the source URL.

### Tests

- renders source card with required metadata;
- gracefully handles missing author/date/image;
- `Read original` uses safe external navigation behavior;
- source list deduplicates canonical URLs;
- source actions are accessible by keyboard.

### Acceptance criteria

- Users can see source cards before or alongside AI synthesis.
- Users can open originals easily.
- Existing answer rendering remains intact.

## 6. Phase 3 — Source click tracking and publisher/source metrics

### Goal

Measure whether the product drives traffic to original sources.

### Database additions

```text
source_events
- id varchar primary key
- user_id varchar nullable
- chat_id varchar nullable
- source_id varchar nullable
- event_type varchar not null
  - impression
  - open_original
  - open_reader
  - save
  - copy_link
  - report
- source_url text
- source_domain text
- page_url text nullable
- metadata jsonb nullable
- created_at timestamp default now()
```

### Privacy notes

- Avoid storing unnecessary full query text in event records.
- For guests, store minimal anonymous/session-level data.
- Do not store sensitive uploaded-file URLs in public analytics surfaces.

### API routes

```text
app/api/source-events/route.ts
```

### Tests

- validates event type;
- rejects oversized metadata;
- allows anonymous low-risk events if configured;
- associates authenticated user ID when available;
- does not fail the UI if analytics write fails.

### Acceptance criteria

- Source impressions and opens can be measured.
- Product can later report outbound source click-through rate.

### Implementation status

Initial source-open tracking is implemented:

- `source_events` schema and migration added with insert-only RLS.
- `/api/source-events` validates event type, URL scheme, page URL, and metadata size.
- Source cards send `open_original` events with minimal metadata and path-only page context.
- Persistence failure returns a non-blocking `202` response so source navigation is not broken.

Remaining follow-up:

- Add impression tracking once source card visibility thresholds are defined.
- Add publisher/source aggregate reporting once the event stream has production data.

## 7. Phase 4 — Feed-aware retrieval planner

### Goal

When a query is made, the app should be able to search feeds as a first-class information source, not only general web search.

### Current state

The app already has a feed tool capable of discovering and reading RSS, Atom, RDF/RSS, JSON Feed, and podcast metadata.

### Desired retrieval behavior

For relevant queries, the planner should consider:

- general search;
- known/subscribed feeds;
- discovered feeds from high-ranking domains;
- news/trending feeds;
- direct URLs;
- uploaded files.

### Initial implementation: simple feed blending

Start with a deterministic, low-risk approach:

1. Add a feed source registry.
2. Add optional default news/trending feeds via config.
3. Add user feed subscriptions later.
4. For news/latest queries, run feed retrieval alongside normal search.
5. Normalize feed items into source cards.
6. Let synthesis use both search results and feed items.

### Config proposal

```env
ENABLE_FEED_RETRIEVAL=true
DEFAULT_NEWS_FEEDS=https://example.com/rss,https://example.org/feed.json
FEED_QUERY_MAX_ITEMS=20
FEED_CACHE_TTL_SECONDS=900
```

### Database additions for subscriptions

```text
feed_subscriptions
- id varchar primary key
- user_id varchar not null
- feed_url text not null
- site_url text
- title text
- description text
- format varchar
- is_podcast boolean default false
- created_at timestamp default now()
- updated_at timestamp nullable

feed_items_cache
- id varchar primary key
- feed_url text not null
- item_url text
- title text not null
- author text
- published_at timestamp nullable
- updated_at timestamp nullable
- summary text
- content text
- raw jsonb nullable
- fetched_at timestamp default now()
```

### Retrieval rules

Use feed retrieval when:

- user asks for news/latest/recent updates;
- query references a known followed source;
- query asks about podcasts/episodes;
- query asks for articles from subscribed sources;
- Discovery/News page is being populated.

Avoid feed retrieval when:

- query is a simple stable definition;
- query is local-only/file-only;
- query is clearly a map/place request;
- query is a pure coding/math task with no web/news component.

### Tests

- identifies news/latest queries;
- reads configured feeds;
- normalizes feed items as sources;
- deduplicates feed item URLs against search results;
- gracefully handles broken feeds;
- caches feed reads;
- does not block the whole answer if one feed fails.

### Acceptance criteria

- News/latest queries can include feed-derived source cards.
- Feed failures are isolated.
- Search results and feed results dedupe by canonical URL.

### Implementation status

Initial feed-aware search blending is implemented:

- `ENABLE_FEED_RETRIEVAL=true` enables deterministic feed blending.
- `DEFAULT_NEWS_FEEDS` configures comma-separated RSS, Atom, RDF/RSS, or JSON feed URLs.
- News/latest-style queries and `content_types=["news"]` searches trigger feed reads.
- Feed item URLs are deduplicated against search result URLs by canonical URL.
- Feed reads use an in-memory TTL cache and isolate per-feed failures.
- Feed-derived search entries carry feed metadata so source cards can render them as feed/podcast sources.

Remaining follow-up:

- Add authenticated user feed subscriptions.
- Persist feed item cache in `feed_items_cache` once subscription storage exists.
- Add source-specific retrieval rules for followed sources and podcast episode queries.

## 8. Phase 5 — Reading queue and source library

### Goal

Let users save sources and continue reading later.

### Database additions

```text
reading_items
- id varchar primary key
- user_id varchar not null
- source_id varchar nullable
- url text not null
- canonical_url text
- title text not null
- author text
- site_name text
- domain text
- published_at timestamp nullable
- summary text
- status varchar not null default 'unread'
  - unread
  - reading
  - read
  - archived
- saved_from_chat_id varchar nullable
- created_at timestamp default now()
- updated_at timestamp nullable

collections
- id varchar primary key
- user_id varchar not null
- title text not null
- description text
- visibility varchar not null default 'private'
- created_at timestamp default now()
- updated_at timestamp nullable

collection_items
- collection_id varchar not null
- reading_item_id varchar not null
- created_at timestamp default now()
```

### UI

- Save button on source cards.
- Reading queue page or sidebar section.
- Saved source chips in chat/research spaces.
- Collection creation.

### Tests

- authenticated user can save source;
- duplicate save updates existing item instead of creating duplicates;
- user cannot access another user’s saved items;
- status transitions work;
- collection membership works.

### Acceptance criteria

- Users can save a source from search results.
- Users can view saved sources.
- Saved source data is private by default.

### Implementation status

Initial reading queue support is implemented:

- `reading_items` schema and migration added with user-scoped RLS.
- `/api/reading-items` supports save, list, and status update.
- Source cards include a Save action that stores normalized source metadata.
- Duplicate saves update the existing item by user and canonical URL.
- `/library` displays saved sources and opens originals through guarded navigation.
- Account deletion removes saved reading items before auth deletion.

Remaining follow-up:

- Add collections and collection membership.
- Add richer library filtering/search and status controls in the UI.
- Add saved-source chips in chat/research spaces.

## 9. Phase 6 — Gist top module for standard search page

### Goal

Add bite-sized Gist-style information at the top of the standard search page while preserving the full standard search page below.

### Product behavior

- Gist appears above standard results when source coverage is sufficient.
- Users can quickly skim multimedia cards.
- Users can scroll down immediately to standard source cards, AI synthesis, and result list.
- Gist should never be the only path to source material.

### Gist generation flow

1. Retrieve and normalize sources.
2. Generate a deck outline.
3. Generate cards from the outline.
4. Deduplicate repeated claims.
5. Attach source IDs to every factual card.
6. Render cards.
7. Provide final “Read the originals” card.

### Card types

```ts
export type GistCardType =
  | 'summary'
  | 'key-fact'
  | 'timeline'
  | 'source-comparison'
  | 'quote'
  | 'context'
  | 'what-changed'
  | 'uncertainty'
  | 'read-originals'
```

### Suggested schema

```text
gist_decks
- id varchar primary key
- chat_id varchar nullable
- user_id varchar nullable
- query text not null
- title text not null
- status varchar not null
  - draft
  - complete
  - failed
- created_at timestamp default now()

gist_cards
- id varchar primary key
- deck_id varchar not null
- card_order integer not null
- card_type varchar not null
- title text not null
- body text not null
- media_url text nullable
- source_ids jsonb not null default '[]'
- metadata jsonb nullable
- created_at timestamp default now()
```

### UI components

```text
components/gist/gist-module.tsx
components/gist/gist-card.tsx
components/gist/gist-card-carousel.tsx
components/gist/gist-card-source-chips.tsx
components/gist/gist-progress.tsx
```

### Tests

- renders Gist module above standard results;
- cards preserve source IDs;
- missing media does not break layout;
- keyboard navigation works;
- mobile swipe behavior works;
- final card links to original sources;
- repeated claims are removed or merged.

### Acceptance criteria

- Standard search page can show Gist at top.
- Standard source/results page remains below.
- Every factual card has source attribution.

## 10. Phase 7 — Discovery / News page

### Goal

Create a Discovery/News page that uses multimedia Gist experience on top and trending news/links underneath.

### Naming

Current name: Discovery.

Possible rename: News.

Decision criteria:

- Use **News** if the page primarily covers current events, trending links, and source feeds.
- Use **Discovery** if it covers broader topics: articles, podcasts, explainers, videos, sources, and personal recommendations.
- Use **Discover** if a more consumer/mobile naming style is preferred.

### Page structure

1. Top multimedia Gist module.
2. Trending story clusters.
3. Source links under each cluster.
4. Followed feeds/latest from sources.
5. Category filters.
6. Reading queue.

### Story cluster model

```text
story_clusters
- id
- title
- summary
- category
- story_key
- source_count
- freshness_score
- created_at
- updated_at

story_cluster_sources
- cluster_id
- source_id
- role
  - primary
  - supporting
  - dissenting
  - background
```

### Initial low-cost implementation

Avoid building a full trend engine at first.

Start with:

- configured news feeds;
- provider news search when available;
- simple clustering by normalized title/entity keywords;
- recency ranking;
- source diversity ranking.

### Tests

- page loads without auth;
- feed failures do not break page;
- story clusters dedupe duplicate URLs;
- trending links remain clickable;
- Gist top module degrades gracefully when not enough sources exist.

### Acceptance criteria

- Discovery/News page shows multimedia Gist module at top.
- Trending links appear underneath.
- Feed-derived items are included.

### Implementation status

Initial Discovery support is implemented:

- `/discovery` loads without requiring authentication.
- Configured `DEFAULT_NEWS_FEEDS` are read through the existing hardened feed parser.
- Feed failures are isolated so one broken feed does not break the page.
- Feed items normalize into source records and dedupe by canonical URL.
- Story clusters are built with simple deterministic title-key clustering and recency ranking.
- The Gist module renders above clusters when source coverage is sufficient and disappears when it is not.
- Trending links remain available underneath through guarded external navigation.

Remaining follow-up:

- Add persisted story cluster tables once clustering behavior stabilizes.
- Add richer source-diversity clustering across search providers, feeds, podcasts, and followed sources.
- Add category controls that can filter/refetch by topic instead of only displaying discovered categories.
- Add user-specific followed feeds and reading queue shortcuts on the Discovery page.

## 11. Phase 8 — Claim-level evidence verification

### Goal

Reduce hallucination and fake citation risk.

### Pipeline

1. Generate answer.
2. Extract atomic factual claims.
3. For each claim, inspect cited source snippets/content.
4. Classify support state.
5. Store evidence map.
6. Render support indicators.

### Schema

```text
answer_claims
- id varchar primary key
- message_id varchar not null
- claim_text text not null
- support_status varchar not null
  - supported
  - partially_supported
  - contradicted
  - uncited
  - unavailable
- confidence numeric nullable
- verifier_model text nullable
- created_at timestamp default now()

claim_sources
- id varchar primary key
- claim_id varchar not null
- source_id varchar nullable
- source_url text nullable
- quote text nullable
- support_type varchar not null
  - supports
  - partially_supports
  - contradicts
  - background
- created_at timestamp default now()
```

### UX

- “Evidence checked” badge.
- Claim hover or drawer.
- Unsupported claim warning.
- Source disagreement panel.
- User feedback button.

### Tests

- supported claim passes;
- unsupported claim is flagged;
- contradicted claim is flagged;
- uncited claim is flagged;
- verifier failure does not block answer rendering;
- evidence drawer shows source quotes.

### Acceptance criteria

- At least basic claim verification works behind a feature flag.
- UI can show claim support states.

### Implementation status

Initial claim verification support is implemented:

- `ENABLE_CLAIM_VERIFICATION=true` enables a deterministic snippet-level evidence panel under assistant answers.
- Answer text is split into atomic sentence-level claims while preserving the app's `[number](#toolCallId)` citation format.
- Cited claims are checked against existing citation-map snippets/content without triggering new retrieval.
- Completed Google Fact Check tool outputs are consumed as external claim-review evidence when present.
- Claims are classified as `supported`, `partially_supported`, `contradicted`, `uncited`, or `unavailable`.
- Verifier failures are non-blocking and render an unavailable state instead of blocking the answer.
- Evidence cards show support status, evidence type, source/review links, and source quotes or fact-check ratings.
- Google Fact Check outputs persist through message storage using dynamic-backed tool columns and round-trip into Phase 8 evidence after reload.

Remaining follow-up:

- Persist `answer_claims` and `claim_sources` once verifier behavior is stable.
- Add model-assisted verification behind a separate cost/rate-limit guard.
- Add a claim details drawer or hover affordance tied directly to answer text spans.
- Add source disagreement panels when multiple cited sources conflict.

## 12. Phase 9 — Source preferences and ranking controls

### Goal

Let users explicitly control source ranking and filtering.

Kagi reference point: Kagi exposes per-domain controls such as block, lower,
normal, higher, and pin-to-top, then lets users manage those rules in settings.
This phase implements the same product principle in Morphic terms: `trust`,
`prefer`, `mute`, and `block`.

### Database additions

```text
source_preferences
- id varchar primary key
- user_id varchar not null
- profile_id varchar nullable
- target text not null
- target_type varchar not null
- domain text not null
- preference varchar not null
  - trust
  - prefer
  - mute
  - block
- note text nullable
- created_at timestamp default now()
- updated_at timestamp nullable
```

```text
source_preference_profiles
- id varchar primary key
- user_id varchar not null
- name text not null
- slug varchar not null
- settings jsonb not null
- is_active boolean default true
- created_at timestamp default now()
```

### UI

- Settings page source controls for domain or URL rules.
- Settings page source profile controls for topic-scoped rule sets.
- Source cards show compact badges when a result matched a remembered rule.
- Trust/block buttons on source cards are still a future shortcut.
- Import/export source preferences remains deferred.
- Import/export source profiles remains deferred.

### Retrieval integration

- Chat has a `sourcePreferences` tool. Use it only when users explicitly ask to
  rely on, prefer, avoid, mute, block, or never use a source/domain/URL.
- Search applies preferences after provider results and configured feed results
  are blended:
  - `block` removes matched results;
  - `mute` demotes matched results;
  - `prefer` boosts matched results;
  - `trust` boosts matched results above ordinary preferred sources.
- Search applies global preferences plus the best active source profile for the
  query. Profile matching uses explicit include/exclude terms saved with the
  profile; unrelated profile rules are not applied.
- Chat can save a profile-scoped preference when the user explicitly says a
  source rule applies to a topic, subject, or use case.
- Provider-level `exclude_domains`/boost hints remain a future optimization.
- Never infer durable preferences from one-off citations or casual mentions.

### Tests

- blocked domains are excluded;
- preferred/trusted domains are boosted;
- muted domains are demoted;
- preferences are user-scoped through the API/action layer;
- invalid domains and unsafe protocols are rejected/sanitized;
- the researcher exposes the preference memory tool in Quick and Adaptive modes.
- profile-scoped preferences only apply when the query matches the profile.

### Acceptance criteria

- Users can block and prefer sources.
- Retrieval respects source preferences.
- Users can manually manage preferences in Settings.
- Users can express explicit source preferences in chat and the app remembers them.
- Users can create topic-scoped source profiles and attach source rules to them.

## 13. Phase 10 — Reader view and article interaction

### Goal

Help users read original sources without replacing them.

### Features

- Open original link.
- Optional reader view for readability.
- Show publisher/source metadata.
- Section summary remains deferred.
- Ask questions about this source remains deferred.
- Highlight/source notes remain deferred.
- Save to collection is covered by the Phase 7 reading queue, with deeper
  collection support deferred.

### Important boundary

Reader view should not become a large-scale article cloning system. It should be user-initiated and source-linked.

### Tests

- reader view requires explicit user action through source card/library links;
- source URL remains visible;
- unsupported content types are rejected;
- private/internal URLs are blocked through `safeFetch`;
- source metadata remains attached.

### Acceptance criteria

- User can open and inspect a source from the app.
- Source remains central and clearly attributed.

Implemented Phase 10 slice:

- Added `/reader` and `/api/reader`.
- Reader API accepts only explicit source URLs, normalizes attribution metadata,
  fetches with SSRF/redirect hardening, rejects unsupported content types before
  buffering, and caps response reads.
- Source cards and Library entries expose an explicit Reader action while
  keeping Read original visible.

## 14. Phase 11 — Production hardening

### Goal

Make public deployment safer and more cost-resilient.

### Required hardening

#### SSRF and URL fetching

- Block private IP ranges.
- Block localhost, link-local, multicast, and metadata IPs.
- Resolve DNS before request.
- Re-check DNS/IP after redirects.
- Limit redirects.
- Limit response size before buffering.
- Allow only HTTP/HTTPS schemes.
- Add egress controls where deployment platform supports it.

#### Rate limiting

Current fail-open behavior is useful for local development but risky in public cloud mode.

Add configurable fail modes:

```env
RATE_LIMIT_FAILURE_MODE=fail-open | fail-closed | emergency-cap
GUEST_RATE_LIMIT_FAILURE_MODE=fail-closed
ADAPTIVE_RATE_LIMIT_FAILURE_MODE=fail-closed
```

#### Uploads

- Use private buckets by default.
- Use signed URLs.
- Use random object IDs rather than predictable user/chat paths.
- Validate magic bytes, not only MIME type.
- Scan PDFs where possible.
- Add retention/deletion path.
- Enforce per-user storage quotas.

#### Feedback table

- Review RLS policy.
- Avoid public select access to raw feedback.
- Treat user agent/page URL as sensitive enough to protect.

#### Cost controls

- Per-mode cost budgets.
- Per-provider timeout and retry policy.
- Tool-call budget by mode.
- Extraction budget by query.
- Emergency provider disable flag.

### Tests

- private IP fetch blocked;
- redirect to private IP blocked;
- large response aborted;
- guest rate-limit backend failure blocks or caps according to config;
- file upload rejects fake MIME;
- feedback not publicly readable unless intended.

### Acceptance criteria

- Public deployment has safe defaults.
- Cost-abuse paths are controlled.

Implemented Phase 11 slice:

- Added configurable rate-limit backend failure policies:
  `fail-open`, `fail-closed`, and `emergency-cap`.
- Guest rate limiting now defaults to fail-closed in cloud deployment mode unless
  explicitly overridden.
- Adaptive and overall rate-limit failure behavior can be controlled with
  limiter-specific environment variables.
- DNS resolution failures in the SSRF guard now fail closed in cloud deployment
  mode by default, with an explicit local-development fail-open override.
- Uploads now validate JPEG, PNG, and PDF magic bytes before storage.
- Upload object keys now use random object IDs under a user upload prefix rather
  than predictable chat-scoped paths.
- Added migration `0016_feedback_private_select` to remove public feedback
  select policies while preserving public insert support.

Still deferred:

- Private bucket signed URL migration.
- PDF malware/content scanning.
- Upload retention and per-user storage quotas.
- Per-mode/provider/tool cost budgets.

## 15. Phase 12 — Evaluation suite

### Goal

Create regression tests for answer quality, citation integrity, source diversity, and traffic-forward behavior.

### Evaluation categories

- stable factual query;
- breaking/news query;
- controversial query;
- source comparison query;
- feed-only query;
- user-provided URL query;
- file query;
- ambiguous query;
- query with bad/stale sources;
- query requiring “I don’t know” or uncertainty.

### Metrics

- at least one source used for informational query;
- citations map to actual tool calls;
- source cards rendered;
- original links available;
- answer does not overquote/overcopy;
- unsupported claims flagged;
- source diversity threshold met where appropriate;
- feed results included for feed-relevant queries;
- tool-call count within budget.

### Acceptance criteria

- CI includes core unit tests.
- Optional integration/eval suite can run locally or on scheduled CI.
- Quality regressions are visible before release.

## 16. Recommended order summary

1. **Phase 0:** Internal docs and private-note ignore rules.
2. **Phase 1:** Source normalization layer.
3. **Phase 2:** Source cards on standard search page.
4. **Phase 3:** Source click tracking and traffic-forward metrics.
5. **Phase 4:** Feed-aware retrieval planner.
6. **Phase 5:** Reading queue and source library.
7. **Phase 6:** Gist top module for standard search page.
8. **Phase 7:** Discovery/News page with Gist top + trending links underneath.
9. **Phase 8:** Claim-level evidence verification.
10. **Phase 9:** Source preferences and ranking controls.
11. **Phase 10:** Reader view and article interaction.
12. **Phase 11:** Production hardening.
13. **Phase 12:** Evaluation suite.

Some phases can overlap, but avoid building the full Gist experience before source normalization, source cards, and basic source event tracking exist.

## 17. Near-term engineering checklist

### Immediate

- Add docs.
- Add `.gitignore` local-private docs rules.
- Do not change public README yet.

### Next PR after docs

- Implement `NormalizedSource` type and normalization helpers.
- Add unit tests for search/feed/fetch normalization.
- Add source card UI with mock/static data first.
- Wire source cards to real search tool output after the UI is stable.

### Next after source cards

- Add source event tracking.
- Track open-original clicks.
- Add feed blending behind a flag.
- Add initial reading queue schema.

### After that

- Add Gist module skeleton. Implemented in Phase 6 as a source-backed standard-search top module.
- Generate Gist cards from normalized sources. Implemented for deterministic summary, coverage, and read-originals cards; persisted deck generation remains future work.
- Add Discovery/News route. Implemented in Phase 7 as a configured-feed Discovery page with deterministic story clusters.
- Add claim verifier behind flag. Implemented in Phase 8 as deterministic snippet-level evidence verification.

## 18. Definition of done for the product direction

The product direction is working when a user can:

1. Ask a question.
2. See a bite-sized Gist summary at the top when appropriate.
3. Scroll down to source cards and standard results.
4. Open original sources easily.
5. See which claims are supported by which sources.
6. Save sources to a reading queue.
7. Subscribe to feeds and search across them.
8. Control preferred/blocked sources.
9. Use AI without feeling trapped away from the web.

The product should feel like a trustworthy research and reading companion, not a black-box answer machine.
