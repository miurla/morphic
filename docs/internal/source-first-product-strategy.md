# Source-First AI Research and News Strategy

> Internal development planning document. This is not public-facing product copy. Because this repository is public, any committed copy of this document is still publicly visible. Use `docs/private/` or `*.local.md` for truly private local notes; those paths are ignored by `.gitignore`.

## 1. Product framing

Morphic should not be treated as a Neeva-scale search engine. Neeva attempted to build an ad-free consumer search engine with its own large search stack, independent crawling/indexing, personalization, browser/app distribution, and AI answer surfaces. That direction is operationally expensive and strategically unnecessary for this project.

The project should instead be framed as a **source-first AI research, reading, and news client**:

- It uses external or self-hosted search providers rather than building a full web index.
- It uses feeds, direct URLs, user files, search APIs, and structured source connectors as retrieval inputs.
- It helps users understand, compare, save, and open original sources.
- It uses AI to reduce research friction, not to trap users away from publishers.
- It treats source traffic, citation integrity, and user trust as first-class product requirements.

The product stance is:

> AI should guide users through the web, not replace the web.

## 2. Core user problem

Many users dislike AI search because it can feel like a substitute for websites, journalists, creators, forums, blogs, and documentation. Common objections include:

- AI summaries can be wrong while sounding confident.
- Citations can be decorative rather than genuinely supporting claims.
- Publishers lose traffic when the answer page fully substitutes for the original article.
- Users lose source context, authorship, publication date, and editorial framing.
- Search becomes opaque: users cannot tell why a source was chosen.
- AI answer engines often compress disagreement into a false consensus.
- The experience can be either classic search links or AI answer text, with no good middle ground.

This project should explicitly solve that tension. It should not be “classic search versus AI search.” It should be **search + AI + source reading + source control**.

## 3. Product principles

### 3.1 Source-first

Sources are not footnotes. They are primary UI objects.

Every meaningful answer should show source cards that include, when available:

- title;
- domain/site name;
- author/byline;
- publication date or update date;
- source type: article, feed item, official document, forum thread, PDF, podcast episode, video, image, map/place, etc.;
- short source summary;
- original URL;
- clear “Read original” action;
- save/read-later action;
- evidence/quote drawer;
- source feedback controls.

### 3.2 Traffic-forward

The UI should make opening original sources natural and prominent.

Traffic-forward design requirements:

- Source cards should be near the top of answer/result views, not buried under generated text.
- The primary source action should be “Read original” or equivalent.
- Summary length should be proportional to user need and should not become a full substitute for long-form articles.
- Gist cards should orient users quickly and then encourage source exploration.
- Outbound source clicks should be measured so the product can verify that it drives traffic.
- Publisher/source metadata should be preserved wherever possible.

### 3.3 Citation integrity

A citation should mean “this source supports this claim,” not merely “this source was somewhere in the retrieval context.”

The system should evolve toward claim-level citation verification:

- Split final answers into atomic claims.
- Map claims to source passages.
- Mark support state: supported, partially supported, contradicted, uncited, or unavailable.
- Surface unsupported or weakly supported claims to the user.
- Allow users to report bad citations.

### 3.4 Progressive disclosure

Users should get bite-sized information first, then deeper source access.

The experience should support multiple depths:

1. **Gist:** short, multimedia, card-style orientation.
2. **Standard search/results:** source cards and traditional result list.
3. **Answer/research synthesis:** AI-generated explanation with citations.
4. **Evidence view:** claim-to-source support.
5. **Reader view/source view:** original source reading and annotation.
6. **Saved research:** collections, reading queue, and source memory.

### 3.5 User-controlled sources

Users should be able to shape their information environment explicitly.

Planned controls:

- preferred domains;
- blocked domains;
- trusted source groups;
- preferred source types, such as official docs, local news, academic sources, forums, independent blogs, or videos;
- feed subscriptions;
- OPML import/export;
- “prefer primary sources” toggle;
- “show source disagreement” toggle;
- topic-specific source preferences.

### 3.6 Privacy-conscious modes

The product should make retrieval and persistence behavior clear.

Expected modes:

| Mode | Persistence | Use case |
| --- | --- | --- |
| Guest | Ephemeral where possible | Trial use, low-friction discovery |
| Signed-in cloud | Stored chats, sources, preferences | Normal user experience |
| Local/self-hosted | User/operator controlled | Privacy-sensitive or developer deployment |
| Future local-first/private mode | Local source library and local preferences | Personal research without unnecessary cloud retention |

## 4. What to take from Perplexity

Perplexity popularized a useful workflow:

1. Ask a natural-language question.
2. Search the current web.
3. Synthesize an answer.
4. Show citations.
5. Continue with follow-up questions.
6. Save/share the research thread.

Take these ideas:

- fast answer flow;
- follow-up threads;
- cited synthesis;
- multi-model support;
- research spaces;
- file analysis;
- more intensive research mode.

Improve these areas:

- Make source cards more prominent than citations alone.
- Add claim-level citation verification.
- Show source disagreement instead of flattening conflict.
- Make “read original” a primary action.
- Add reading queue and source library.
- Expose model/provider/search-route transparency where useful.
- Add traffic-forward metrics.

## 5. What to take from Neeva

Neeva’s strongest ideas were user alignment and source control:

- ad-free search;
- no hidden affiliate ranking;
- privacy-first positioning;
- user-controlled source preferences;
- personal/cloud search integrations;
- community/forum source surfacing;
- AI summaries with visible citations;
- publisher/creator revenue-sharing principles.

Take these ideas:

- explicit source controls;
- ad-free and non-manipulative ranking defaults;
- source transparency;
- human/community source surfacing;
- personal research library direction;
- publisher-friendly design.

Improve these areas:

- Avoid needing an expensive independent index.
- Prefer feeds and user-selected sources where available.
- Make traffic-forward UI measurable.
- Keep personalization explicit rather than hidden.
- Let users delete uploaded files, chats, source preferences, and derived state.
- Avoid making the AI answer a full substitute for the original article.

## 6. What to take from Neeva Gist

Neeva Gist’s novel idea was mobile-native, visual AI search: bite-sized summary cards that helped users quickly understand a topic without forcing them into ten blue links or a long AI text wall.

Take these ideas:

- bite-sized cards;
- multimedia summaries;
- swipeable/scrollable story-like progression;
- fast orientation before deeper reading;
- source-backed cards;
- topic/news discovery as a visual experience.

Current project direction:

- **Standard search page:** Gist appears at the top of the normal search page. Users see bite-sized information first, then can scroll down to the standard search results/answer page.
- **Discovery/News page:** A multimedia Gist experience appears at the top, with trending news and links underneath.
- The Discovery page may be renamed to **News** if that better matches user expectations.

Improve over Neeva Gist:

- Avoid repetitive cards by generating a coherent deck outline first.
- Ensure each card has source IDs and visible source actions.
- Add a final “Read the originals” card.
- Add a “source disagreement” card for contested stories.
- Add timeline cards for evolving news.
- Add “What changed?” cards for returning users.
- Keep the standard search/results view immediately accessible below the Gist module.

## 7. Feed-aware retrieval strategy

The app already supports RSS, Atom, RDF/RSS, and JSON Feed. Feeds should be treated as source inputs, not just a separate utility.

When a query is made, the retrieval planner should be able to search across:

- configured search provider results;
- user-subscribed feeds;
- discovered feeds from relevant domains;
- trending/news feeds;
- user-uploaded files;
- directly provided URLs;
- future saved reading library items.

Feed retrieval should be especially important for:

- news queries;
- “latest from my sources” queries;
- publisher-specific queries;
- podcasts/episodes;
- blog/newsletter discovery;
- local news;
- source comparison.

Feed results should preserve structured metadata:

- title;
- URL;
- publication date;
- updated date;
- author;
- summary/content;
- enclosure/media;
- podcast metadata;
- feed title;
- site URL;
- feed format;
- source attribution.

## 8. Standard search page experience

The standard search page should be layered:

1. **Query/composer area.**
2. **Gist top module** when enough source material exists.
3. **Source cards** with primary source actions.
4. **AI synthesis** with citations and evidence indicators.
5. **Standard results list** for users who prefer classic search browsing.
6. **Related questions/follow-ups.**
7. **Save/share/export actions.**

Design requirement: users who dislike AI summaries should still be able to use the page as a source discovery and reading interface.

## 9. Discovery / News page experience

The Discovery page may become the News page if product language shifts toward a smart news reader.

Suggested structure:

1. **Top multimedia Gist module**
   - major story cards;
   - short multimedia summaries;
   - timeline/update cards;
   - source comparison cards;
   - read-original actions.

2. **Trending news/links below**
   - ranked links;
   - source clusters;
   - local/national/world/tech/science categories;
   - source diversity indicators;
   - feed-derived items;
   - user-source preference filters.

3. **Followed sources / feeds**
   - latest from feeds;
   - unread items;
   - saved sources;
   - OPML import/export later.

4. **Reader queue**
   - saved articles;
   - continue reading;
   - research collections.

## 10. Answer types and UI modes

| User intent | Preferred experience |
| --- | --- |
| Quick fact | Short answer + source card |
| Breaking news | Gist timeline + source cluster + latest links |
| Deep research | Adaptive mode + source inspector + evidence map |
| “What are people saying?” | Forums/community sources + source-type labels |
| “Summarize this article” | Fetch/reader mode + short summary + open original |
| “Compare coverage” | Source comparison cards |
| “Latest from sources I follow” | Feed search + News page/feed view |
| “Find something to read” | Discovery/News page + reading queue |

## 11. Measurement goals

Track product quality using metrics that align with the source-first mission.

### Trust metrics

- citation support rate;
- unsupported claim rate;
- contradicted claim rate;
- user-reported citation issues;
- source diversity per answer;
- primary-source ratio.

### Publisher/source metrics

- source card impressions;
- source card clicks;
- original-open clicks;
- reader-view opens;
- saved source count;
- outbound click-through rate;
- source subscription/follow actions.

### User value metrics

- successful query completion;
- follow-up rate;
- saved-to-reading-queue rate;
- return-to-research-space rate;
- source preference usage;
- Gist expand/scroll-through rate.

### Cost metrics

- tool calls per query;
- search provider cost per query;
- model cost per query;
- feed cache hit rate;
- Adaptive mode quota usage;
- extraction/fetch cost.

## 12. Non-goals

The project should not attempt to become all of these immediately:

- a full web crawler/index;
- a Google-scale general search engine;
- a publisher content warehouse;
- a full article replacement engine;
- a closed answer portal that minimizes outbound traffic;
- a hidden affiliate ranking system;
- a generic chatbot with search bolted on.

## 13. Working product thesis

The product should become a **source-first AI research and news client** that combines:

- Perplexity-style fast answer and follow-up workflow;
- Neeva-style user alignment, ad-free/source-control philosophy;
- Neeva Gist-style bite-sized multimedia cards;
- feed-aware source discovery;
- transparent evidence and citation verification;
- traffic-forward reading design.

The goal is not to replace websites. The goal is to make the web easier to understand, easier to verify, and easier to read.
