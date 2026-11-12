# Revise suggestions

Revise follows the latest editing intent and all earlier constraints still in force: target passages, passages to keep, word count, structure, FAQ, audience, etc. Suggestions must stay within that scope and avoid completed changes. A fixed length/tone/content checklist is no longer required.

New buttons use `submitRevision` with `query` and `intent` (`alternatives` or `edit`). Labels explicitly distinguish seeing alternatives from rewriting. Unlike Related, a short Revise label can have a longer, self-contained query carrying the scope and constraints.

- **Alternatives** sends a chat-only request. The draft tool rejects edits for that turn, draft history ignores any unexpected draft blocks or tool writes, and live draft preview stays unchanged. Candidates require a later user selection and explicit application request.
- **Edit** sends a request to change only the specified passage, retaining all other text and active constraints. Exact find/replace edits preserve surrounding text. Scope selection and compliance with linguistic requirements still depend on the model.

The app adds a fixed instruction prefix to preview requests. The same shared helper recognizes it in both saved and ephemeral chat generation, draft history replay and live preview. It is a behavior guard for these buttons, not a general permission system for arbitrary user messages. Ordinary chat requests still follow the draft prompt rules. A later explicit apply request is an ordinary edit turn.

## Events

| Event                       | Trigger                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `revise_suggestion_shown`   | A ready Revise suggestion block intersects the viewport, once per suggestion per mounted block |
| `revise_suggestion_clicked` | A valid Revise click is accepted while no answer is generating                                 |
| `related_question_clicked`  | Existing Related action; existing payload `{ chatId }` is retained                             |

Both Revise events have only these application properties:

| Property       | Definition                                                                                |
| -------------- | ----------------------------------------------------------------------------------------- |
| `chatId`       | Chat from the current route, when present                                                 |
| `messageId`    | Assistant message containing the suggestions                                              |
| `suggestionId` | App-generated positional ID, `revise-1`, `revise-2`, etc.; never the generated element ID |
| `position`     | Zero-based order among reachable valid Revise buttons                                     |
| `intent`       | `alternatives`, `edit`, or `legacy` for saved Revise buttons using `submitQuery`          |

No draft text, button label, prompt, query, generated element ID, or candidate content is included in these events. PostHog retains its existing SDK/session properties and configuration. This feature adds no autocapture or session recording.

Streaming-rejected clicks emit no click event. A Set prevents duplicate impressions during rerenders, incremental spec updates, and React Strict Mode effect replay. IntersectionObserver avoids counting the hidden responsive chat; environments without it fall back to mounted-block impressions. Missing message context suppresses Revise telemetry. Only reachable buttons under a Revise heading are classified. Saved Revise buttons retain their original query and are marked `legacy`; their old events cannot be retroactively separated from Related.

## Usage calculations

Use the same time range and exclude `legacy` when comparing the two new intents. Define a suggestion key as `(chatId, messageId, suggestionId, intent)`; use PostHog person/session identity as appropriate for your report, especially if `chatId` is missing.

- **Suggestion click-through rate:** distinct shown suggestion keys with an accepted click / distinct shown suggestion keys. Join clicks to impressions, rather than dividing raw event counts.
- **Message usage rate:** distinct shown assistant messages with at least one accepted Revise click / distinct assistant messages with a Revise impression.
- **Intent usage:** compute those rates grouped by `intent`. Count accepted click events for interaction volume; users may click one suggestion more than once.

## Limits and verification

Impressions mean the block entered the viewport, not that every button was read. There is no dwell threshold or per-button visibility test. A remount, navigation, reload, or separate tab can emit a new impression; use distinct keys for rates. Regeneration reusing the same message ID and slot is not a new suggestion-set identifier. During streaming, replacing the content of a slot with the same intent does not emit another impression. PostHog configuration, blockers, connectivity, or privacy settings can prevent delivery; clicks without an observed impression must be excluded from CTR or investigated separately.

Clicks measure accepted requests, not successful generation, candidate selection, application, saved drafts, satisfaction, or task completion. No candidate-application conversion is inferred. The model still determines proposal relevance and edit scope, and context truncation can remove earlier constraints; automated prompt tests do not establish real-model compliance.

Regression coverage includes separate action instructions, protected text after a scoped edit, preview tool rejection and history immutability, explicit later application, impression deduplication and content-free properties, streaming click rejection, legacy Related/Revise behavior, and retaining Revise specs in model history. Live model evaluation and production PostHog delivery require separate verification.
