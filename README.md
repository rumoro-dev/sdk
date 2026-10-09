# Rumoro TypeScript SDK

Social listening for developers and AI agents, typed. [Rumoro](https://rumoro.dev) watches the places people talk about your product, your competitors and your topics, and scores every mention for relevance, sentiment and intent. This package is the official TypeScript client for its API. It has one function per endpoint, generated from the OpenAPI document, with request and response types included. It needs Node 22+ and has no runtime dependencies. Use it on a server: the API does not answer browsers from other sites (no CORS), so a key never ends up in a web page.

## Installation

```bash
npm install @rumoro-dev/sdk
```

## Quick start

```ts
import { createRumoro } from '@rumoro-dev/sdk';

const rumoro = createRumoro({ apiKey: process.env.RUMORO_API_KEY! });

// Track a keyword on two platforms.
await rumoro.createKeyword({ body: { term: 'acme cloud', kind: 'brand', platforms: ['hackernews', 'x'] } });

// Read what arrived, relevant posts only, newest first.
const { data, error } = await rumoro.searchMentions({
  query: { platform: 'hackernews', relevant: true, limit: 25 },
});
if (error) throw new Error(`${error.error.code}: ${error.error.message}`);

for (const mention of data.data) {
  console.log(mention.post.platform, mention.classification?.relevance, mention.classification?.intents, mention.post.url);
}
```

Create an API key in the dashboard (API keys) or with `POST /v1/api-keys`. Keys start with `ref_`. Every account starts with $5.80 of credit, and no card is needed.

## Configuration

```ts
const rumoro = createRumoro({
  apiKey: 'ref_...',                     // required
  baseUrl: 'https://api.rumoro.dev',     // another deployment's host, if you run one
  fetch: customFetch,                    // tests, or a runtime without a global fetch
  headers: { 'x-request-id': 'my-id' },  // sent on every request; the id comes back on the response
});
```

Every call resolves to `{ data, error, request, response }` and never throws on a non-2xx status. Pass `throwOnError: true` on a call to get `data` directly, with an exception on failure:

```ts
const { data: keyword } = await rumoro.getKeyword({ path: { id: 'kw_...' }, throwOnError: true });
```

`rumoro.client` is the underlying client, for interceptors and raw requests:

```ts
rumoro.client.interceptors.response.use((response) => {
  console.log(response.status, response.headers.get('x-request-id'));
  return response;
});
```

## Examples

### Page through every mention of the last week

```ts
let cursor: string | undefined;
do {
  const { data } = await rumoro.searchMentions({
    query: { since: '2026-09-26T00:00:00Z', relevant: true, limit: 100, cursor },
    throwOnError: true,
  });
  for (const mention of data.data) console.log(mention.post.url);
  cursor = data.nextCursor ?? undefined;
} while (cursor);
```

### Filter by intent and sentiment

```ts
const { data } = await rumoro.searchMentions({
  query: { intent: 'buy_intent', sentiment: 'negative', minFollowers: 1000, sort: 'priority' },
  throwOnError: true,
});
```

The intents are `buy_intent`, `question`, `complaint`, `praise` and `comparison`, and topic tags such as `bug_report` and `pricing` filter the same way. `sort: 'priority'` puts fresh, relevant, high-reach posts first.

### Triage

```ts
await rumoro.updateMention({ path: { id: 'mm_...' }, body: { status: 'done', note: 'replied 2026-10-03' } });
await rumoro.updateMention({ path: { id: 'mm_...' }, body: { status: 'ignored' } });
```

### An instant Slack alert for buying signals

```ts
const { data: channels } = await rumoro.listChannels({ throwOnError: true });
const slack = channels.data.find((c) => c.kind === 'slack');

await rumoro.createAlert({
  body: {
    name: 'Buying signals',
    mode: 'instant',
    filter: { intents: ['buy_intent'], minRelevance: 40 },
    channelIds: slack ? [slack.id] : [],
  },
  throwOnError: true,
});
```

Create Slack, Telegram, email and webhook channels with `createChannel`. `testAlert` sends a sample, and `runAlertDigest` sends a digest alert's latest window now.

### Analytics

```ts
const { data: summary } = await rumoro.getAnalyticsSummary({
  query: { range: '30d', compare: true, timezone: 'Europe/Berlin' },
  throwOnError: true,
});
const { data: byPlatform } = await rumoro.getAnalyticsBreakdown({ query: { range: '30d', by: 'platform' }, throwOnError: true });
const { data: sov } = await rumoro.getShareOfVoice({ query: { range: '90d' }, throwOnError: true });
```

### People

```ts
const { data: people } = await rumoro.listPeople({ query: { platforms: ['x'], minFollowers: 5000 }, throwOnError: true });
await rumoro.updatePerson({ path: { id: people.data[0].id }, body: { tags: ['influencer'], muted: false } });
```

### CSV export

```ts
const { data: csv } = await rumoro.exportMentionsCsv({ query: { since: '2026-09-01T00:00:00Z' }, throwOnError: true });
```

## Error handling

A non-2xx response comes back as `error` with a stable code, the message, and the request id to quote to support:

```ts
const { error } = await rumoro.createKeyword({ body: { term: 'acme', kind: 'brand' } });
if (error) {
  switch (error.error.code) {
    case 'duplicate_keyword':      // already tracked
    case 'insufficient_balance':   // top up from Billing
    case 'keyword_limit_reached':  // a workspace tracks up to 500 keywords
    case 'rate_limited':           // Retry-After is on the response
    default:
      console.error(error.error.code, error.error.message, error.error.requestId);
  }
}
```

Common codes: `unauthorized`, `forbidden`, `read_only_key`, `validation_error`, `not_found`, `invalid_cursor`, `rate_limited`, `duplicate_keyword`, `insufficient_balance`, `keyword_limit_reached`, `upstream_unavailable`, `internal_error`. The [OpenAPI document](https://api.rumoro.dev/v1/openapi.json) lists every operation's responses.

## SDK reference

There is one function per operation, named after its `operationId` in the [OpenAPI document](https://api.rumoro.dev/v1/openapi.json).

| Resource | Functions |
| --- | --- |
| Keywords | `createKeyword`, `listKeywords`, `getKeyword`, `updateKeyword`, `deleteKeyword`, `getKeywordHealth` |
| Groups | `listGroups`, `createGroup`, `getGroup`, `updateGroup`, `deleteGroup` |
| Mentions | `searchMentions`, `getMention`, `updateMention`, `exportMentionsCsv`, `exportMentionsJson` |
| Attention | `listAttention`, `dismissAttention` |
| Views | `listViews`, `createView`, `getView`, `updateView`, `deleteView` |
| Filters | `getFilters`, `updateFilters` |
| People | `listPeople`, `getPerson`, `updatePerson`, `mergePeople`, `splitPerson`, `exportPeopleCsv`, `listPersonActivities`, `logPersonActivity`, `deletePersonActivity` |
| Segments | `listSegments`, `createSegment`, `getSegment`, `updateSegment`, `deleteSegment` |
| Alerts | `listAlerts`, `createAlert`, `getAlert`, `updateAlert`, `deleteAlert`, `testAlert`, `runAlertDigest`, `muteAlertAuthors`, `unmuteAlertAuthors` |
| Channels | `listChannels`, `createChannel`, `getChannel`, `updateChannel`, `deleteChannel`, `testChannel`, `rotateWebhookSecret`, `listChannelDeliveries` |
| Analytics | `getAnalyticsSummary`, `getAnalyticsSeries`, `getAnalyticsBreakdown`, `getShareOfVoice`, `getReviewsReport` |
| Company | `getCompany`, `updateCompany` |
| Team | `listMembers`, `removeMember`, `listInvitations`, `createInvitation`, `revokeInvitation` |
| Usage and billing | `getUsage`, `getUsageBreakdown`, `getWallet`, `listLedger`, `createTopUp`, `listInvoices`, `getInvoiceUrl` |
| API keys | `createApiKey`, `listApiKeys`, `revokeApiKey` |
| System | `whoami`, `getHealth` |

Lists return `{ data, nextCursor }` (cursor lists) or `{ data, total }` (offset lists). Timestamps are ISO 8601 strings, and timestamp inputs accept ISO 8601 or epoch milliseconds.

## MCP server

The same API is available to MCP clients as tools, with no SDK at all. In Claude Code:

```bash
claude mcp add --transport http rumoro https://mcp.rumoro.dev/mcp
```

## Requirements

- Node 22+, on a server
- A Rumoro API key

## Links

- [Documentation](https://docs.rumoro.dev)
- [OpenAPI document](https://api.rumoro.dev/v1/openapi.json)
- [Dashboard](https://app.rumoro.dev)

Regenerate from a checkout with `npm run generate` in `packages/sdk`.

## License

MIT.
