# Rumoro TypeScript SDK

[![npm](https://img.shields.io/npm/v/@rumoro-dev/sdk?label=npm)](https://www.npmjs.com/package/@rumoro-dev/sdk)
[![license](https://img.shields.io/npm/l/@rumoro-dev/sdk)](./LICENSE)
[![docs](https://img.shields.io/badge/docs-docs.rumoro.dev-blue)](https://docs.rumoro.dev/sdks/typescript)

Typed access to [Rumoro](https://rumoro.dev), the social listening API for developers and AI agents. Rumoro picks up posts about your product, your competitors and your market on Reddit, X, Hacker News, GitHub, Bluesky, LinkedIn, Stack Overflow, DEV, YouTube, TikTok, Instagram and news, and rates each for relevance, sentiment and intent.

The SDK is generated from Rumoro's OpenAPI document: every endpoint is a function, and every request and response is typed. It runs on Node 22 or later with no runtime dependencies. Keep it on the server side; the API doesn't accept cross-origin browser requests, which keeps your key out of web pages.

## Install

```bash
npm install @rumoro-dev/sdk
```

You need an API key (it starts with `ref_`). Create one on the API keys page of the dashboard, or with `POST /v1/api-keys`. New accounts come with $5.80 of credit and don't need a card.

## First request

```ts
import { createRumoro } from '@rumoro-dev/sdk';

const rumoro = createRumoro({ apiKey: process.env.RUMORO_API_KEY! });

// Start tracking a product name on Hacker News and X.
await rumoro.createKeyword({ body: { term: 'driftwood deploy', kind: 'brand', platforms: ['hackernews', 'x'] } });

// Fetch the latest relevant mentions.
const { data, error } = await rumoro.searchMentions({
  query: { platform: 'hackernews', relevant: true, limit: 25 },
});
if (error) throw new Error(`${error.error.code}: ${error.error.message}`);

for (const mention of data.data) {
  console.log(mention.post.platform, mention.classification?.relevance, mention.classification?.intents, mention.post.url);
}
```

## Client options

```ts
const rumoro = createRumoro({
  apiKey: 'ref_...',                     // required
  baseUrl: 'https://api.rumoro.dev',     // only if you run your own deployment
  fetch: customFetch,                    // for tests, or runtimes without a global fetch
  headers: { 'x-request-id': 'my-id' },  // added to every request; the id is echoed back
});
```

Calls don't throw on HTTP errors by default. Each one resolves to `{ data, error, request, response }`. If you'd rather get the data directly and catch failures as exceptions, add `throwOnError: true`:

```ts
const { data: keyword } = await rumoro.getKeyword({ path: { id: 'kw_...' }, throwOnError: true });
```

For interceptors or raw requests, use the underlying client at `rumoro.client`:

```ts
rumoro.client.interceptors.response.use((response) => {
  console.log(response.status, response.headers.get('x-request-id'));
  return response;
});
```

## Recipes

### Fetch a week of mentions, page by page

```ts
let cursor: string | undefined;
do {
  const { data } = await rumoro.searchMentions({
    query: { since: '2026-10-02T00:00:00Z', relevant: true, limit: 100, cursor },
    throwOnError: true,
  });
  for (const mention of data.data) console.log(mention.post.url);
  cursor = data.nextCursor ?? undefined;
} while (cursor);
```

### Buying signals from accounts with reach

```ts
const { data } = await rumoro.searchMentions({
  query: { intent: 'buy_intent', minFollowers: 1000, sort: 'priority' },
  throwOnError: true,
});
```

Besides the intents (`buy_intent`, `question`, `complaint`, `praise`, `comparison`), topic tags like `bug_report` and `pricing` work as filters too. With `sort: 'priority'`, recent, relevant posts from people with reach come first.

### Close or dismiss mentions

```ts
await rumoro.updateMention({ path: { id: 'mm_...' }, body: { status: 'done', note: 'answered in the thread' } });
await rumoro.updateMention({ path: { id: 'mm_...' }, body: { status: 'ignored' } });
```

### Send purchase intent to Slack as it happens

```ts
const { data: channels } = await rumoro.listChannels({ throwOnError: true });
const slack = channels.data.find((c) => c.kind === 'slack');

await rumoro.createAlert({
  body: {
    name: 'Purchase intent',
    mode: 'instant',
    filter: { intents: ['buy_intent'], minRelevance: 40 },
    channelIds: slack ? [slack.id] : [],
  },
  throwOnError: true,
});
```

`createChannel` adds Slack, Telegram, email and webhook channels. `testAlert` delivers a sample, and `runAlertDigest` sends a digest alert's current window immediately.

### Reports

```ts
const { data: summary } = await rumoro.getAnalyticsSummary({
  query: { range: '30d', compare: true, timezone: 'Europe/Vienna' },
  throwOnError: true,
});
const { data: byPlatform } = await rumoro.getAnalyticsBreakdown({ query: { range: '30d', by: 'platform' }, throwOnError: true });
const { data: sov } = await rumoro.getShareOfVoice({ query: { range: '90d' }, throwOnError: true });
```

### Tag influential authors

```ts
const { data: people } = await rumoro.listPeople({ query: { platforms: ['x'], minFollowers: 5000 }, throwOnError: true });
await rumoro.updatePerson({ path: { id: people.data[0].id }, body: { tags: ['influencer'], muted: false } });
```

### Export to CSV

```ts
const { data: csv } = await rumoro.exportMentionsCsv({ query: { since: '2026-10-01T00:00:00Z' }, throwOnError: true });
```

## Errors

When a request fails, `error` holds a stable `code`, a readable `message` and a `requestId` you can send to support:

```ts
const { error } = await rumoro.createKeyword({ body: { term: 'driftwood', kind: 'brand' } });
if (error) {
  switch (error.error.code) {
    case 'duplicate_keyword':      // this term is already tracked
    case 'insufficient_balance':   // add funds on the Billing page
    case 'keyword_limit_reached':  // the workspace already runs 500 keywords
    case 'rate_limited':           // wait for the Retry-After header
    default:
      console.error(error.error.code, error.error.message, error.error.requestId);
  }
}
```

Codes you're most likely to see: `unauthorized`, `forbidden`, `read_only_key`, `validation_error`, `not_found`, `invalid_cursor`, `rate_limited`, `duplicate_keyword`, `insufficient_balance`, `keyword_limit_reached`, `upstream_unavailable`, `internal_error`. The [OpenAPI document](https://api.rumoro.dev/v1/openapi.json) documents every operation's responses.

## Function index

Each operation in the [OpenAPI document](https://api.rumoro.dev/v1/openapi.json) is a function named after its `operationId`.

| Area | Functions |
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

Lists come back either as `{ data, nextCursor }` or as `{ data, total }`. Dates are ISO 8601 strings; inputs also take epoch milliseconds.

## Prefer MCP?

Agents can use the same operations as MCP tools, with no SDK. In Claude Code:

```bash
claude mcp add --transport http rumoro https://mcp.rumoro.dev/mcp
```

## Good to know

- Requires Node 22 or later, used server-side, and a Rumoro API key.
- To regenerate from a Rumoro checkout, run `npm run generate` in `packages/sdk`.
- [Docs](https://docs.rumoro.dev) · [OpenAPI document](https://api.rumoro.dev/v1/openapi.json) · [Dashboard](https://app.rumoro.dev)

## License

MIT.
