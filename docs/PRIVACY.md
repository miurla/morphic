# Privacy and Telemetry

This document lists everything a self-hosted Morphic instance can send outside your own server, what each destination receives, and how to turn it off.

**Morphic never reports anything to the Morphic project or its maintainers.** There is no phone-home endpoint in the codebase. Beyond that, a self-hosted instance contacts the services you configure credentials for, the sites the agent reads, and the browser-side destinations listed below. One case contacts a service you have not configured: see [Reading pages](#reading-pages).

## Summary

Requests made by your server:

| Destination                                              | What it receives                                                              | Default when self-hosting                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| AI provider (OpenAI, Anthropic, Google, ...)             | Full prompt: system prompt, conversation history, search results, attachments | **On.** Required to answer                  |
| Search provider (Tavily, SearXNG, Exa, Brave, Firecrawl) | The search query the agent generates                                          | **On.** Required to search                  |
| Web pages the agent reads                                | Your server's IP and user agent, to whichever site the agent chose            | On                                          |
| Jina Reader or Tavily Extract                            | The URL being read                                                            | Only when the agent asks for API extraction |
| PostgreSQL                                               | Chats, messages, attachment metadata, feedback                                | On. Local container under Docker            |
| Redis                                                    | Cached search results, rate limit counters, usage counters                    | Local container under Docker                |
| Supabase                                                 | Email, password, OAuth identity, sessions                                     | Off unless configured                       |
| R2 / S3                                                  | Uploaded file bytes, under a key holding the user id, chat id, and filename   | Off unless configured                       |
| Favicon provider (Google by default)                     | The hostname of each cited source                                             | On. Configurable, and can be turned off     |
| Slack                                                    | Feedback text and the submitter's email                                       | Off unless `SLACK_WEBHOOK_URL` is set       |
| PostHog                                                  | Product analytics events. Not the user's query text                           | **Off**                                     |
| Langfuse                                                 | Full prompts and completions as traces                                        | **Off**                                     |
| Vercel Analytics                                         | Page views                                                                    | **Off**                                     |

Requests made by the user's browser, which env vars do not control:

| Destination                         | What it receives                                          | When                                     |
| ----------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| Image hosts from the search results | The visitor's IP and user agent                           | When results with images render          |
| YouTube                             | Standard embed request under the visitor's Google session | Only if the visitor opens a video result |

## Services you configure

These carry your actual content, because the product does not work without them.

### AI providers

Every request sends the full prompt to the provider whose key you configured: the system prompt, the conversation so far, search results the agent retrieved, and attachments. Attachments are passed as signed URLs to your own bucket, which means the provider fetches the file from your storage, and the object key in that URL contains the user id, the chat id, and the original filename. Starting a new chat also sends the first message to the provider a second time, to generate the chat title ([lib/agents/title-generator.ts](../lib/agents/title-generator.ts)).

Separately, rendering a page asks each configured provider for its model list so the model selector can be populated. Those requests carry the API key only, no user content, and are cached briefly.

To keep prompts on your own hardware, use Ollama or another OpenAI-compatible endpoint you run yourself. Provider setup is in [CONFIGURATION.md](./CONFIGURATION.md#ai-providers).

### Search

The search tool sends the query to your configured provider. The query is whatever the model put in the tool call, which is often a rephrasing but can be the user's wording copied verbatim. Treat it as user content.

SearXNG keeps this on your own infrastructure, and the Docker Compose setup ships a SearXNG container and selects it by default. Note that SearXNG itself then queries upstream engines. See [SearXNG Configuration](./CONFIGURATION.md#searxng-configuration).

### Reading pages

By default the `fetch` tool retrieves a URL directly from your server, so only the origin site sees the request. It routes through an extraction service when the agent asks for API extraction, which it does for PDFs and JavaScript-rendered pages: Jina when `JINA_API_KEY` is set, Tavily Extract otherwise.

The Tavily Extract path does not check for a key first, so an instance with no `TAVILY_API_KEY` still posts the URL to Tavily and gets an authentication error back. If you want no requests to Tavily at all, set `JINA_API_KEY` or keep the agent off API extraction.

Advanced SearXNG search additionally crawls the result pages themselves from your server. See [Advanced Search Features](./CONFIGURATION.md#advanced-search-features).

### Storage and infrastructure

PostgreSQL, Redis, Supabase, and R2 or S3 hold whatever you point them at. All four can be local or self-hosted, and Docker Compose runs PostgreSQL and Redis as local containers.

Three details worth knowing if you point Redis at a hosted instance such as Upstash: the advanced-search cache uses the raw search query as part of its cache key, the guest rate limiter uses the visitor's IP address as part of its key, and the rate limit and usage budget keys carry the authenticated user's id.

### Source favicons

Result lists, citations, and image credits show the favicon of each source. Your server fetches those icons and serves them from your own origin at `/api/favicon`, so the visitor's browser never contacts the icon provider and the provider never learns who is reading what. What it does learn is the set of hostnames your instance cites, without any visitor attached.

The provider defaults to Google's favicon service and is configurable through `FAVICON_PROVIDER_URL`, including `off` to fetch nothing and fall back to letter initials. See [Source Favicons](./CONFIGURATION.md#source-favicons).

### Feedback

The site feedback form posts the message text, the submitter's email address, and the page URL to `SLACK_WEBHOOK_URL`. Unset by default, in which case the feedback stays in your database.

## What the browser loads

These are requests from your visitors' browsers, not from your server. They are part of the UI rather than configuration, so no environment variable turns them off today.

**Result images.** Image results and model-emitted images are loaded straight from their origin hosts, so those hosts see visitor IPs and user agents.

**YouTube.** Opening a video result mounts a `youtube.com/embed` iframe, which loads under whatever Google session the visitor has.

Both are the content the search itself returned, loaded from where it lives.

## Analytics and observability

All of these are off by default. None are needed to run Morphic.

### PostHog

Product analytics used by the hosted deployment.

The server-side path requires **both** `MORPHIC_CLOUD_DEPLOYMENT=true` and `POSTHOG_KEY` ([lib/analytics/dispatch.ts](../lib/analytics/dispatch.ts)). The browser-side path is gated on `NEXT_PUBLIC_POSTHOG_KEY` alone and does not consult `MORPHIC_CLOUD_DEPLOYMENT`, so setting only the public key produces browser events even with cloud mode off. Neither key ships with a value, and Docker Compose pins `MORPHIC_CLOUD_DEPLOYMENT=false`.

When it is on, events are attributed to an identity: the Supabase user id for signed-in users, and for guests a distinct id that persists in browser storage across visits. Chat events also carry the user id as a property, and a `$pageview` is sent on every navigation, which for a saved chat means its URL.

Beyond the identity, events carry the model and provider used, the search mode, the conversation turn number, the chat id, and a derived shape of the query: a length bucket, whether it contained a URL, and a coarse language flag. What the user typed is never sent, and no event carries uploaded filenames. The one event that contains prompt text is `example_prompt_clicked`, which records which of the built-in example prompts a visitor clicked on the home screen. That string comes from Morphic's own list, not from the user. Autocapture and session recording are both disabled in [lib/analytics/posthog-client.ts](../lib/analytics/posthog-client.ts). That does not strip the context `posthog-js` attaches to every capture on its own: the current URL and referrer, browser and OS, screen and viewport size, and session and window ids.

### Langfuse

LLM tracing. Off unless `ENABLE_LANGFUSE_TRACING=true`.

The span processor is constructed at startup regardless of the flag, which looks alarming when reading [instrumentation.ts](../instrumentation.ts), but the flag is what registers the AI SDK integration, and without that integration no spans are ever created. The processor drops any span that is not a Langfuse or GenAI span before export, so an instance with the flag off makes no requests.

When you do enable it, traces include full prompts and completions, along with the user's typed text, the assistant's answer, a user id, and the chat id as session id. Point `LANGFUSE_BASE_URL` at a self-hosted Langfuse if that content should not go to Langfuse Cloud.

One related note: OpenTelemetry itself is registered unconditionally, so standard `OTEL_EXPORTER_OTLP_*` environment variables are honored if your environment happens to set them.

### Vercel Analytics

Page views, for the hosted deployment. Rendered only when `MORPHIC_CLOUD_DEPLOYMENT=true`, so a self-hosted instance never loads the script.

### Next.js telemetry

Next.js collects its own anonymous usage telemetry during `build` and `dev`. This is a framework behavior unrelated to Morphic, and it carries no application data. The Docker image disables it during build. If you run from a clone, disable it with:

```bash
NEXT_TELEMETRY_DISABLED=1
```

See [Next.js telemetry](https://nextjs.org/telemetry) for what it covers.

## Fully local setup

To run Morphic with as little as possible leaving your network:

- `OLLAMA_BASE_URL` for the model, instead of a hosted provider key
- `SEARCH_API=searxng` with the bundled SearXNG container, pointed at engines you accept
- The Docker Compose PostgreSQL and Redis containers
- No PostHog, Langfuse, Supabase, R2, or Slack credentials
- `NEXT_TELEMETRY_DISABLED=1`

Pages the agent reads are still fetched from their origin sites, which is the point of a search engine, and the browser-side requests above still happen.
