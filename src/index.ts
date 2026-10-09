import { createClient, createConfig, type Client } from "./generated/client";
import * as sdk from "./generated/sdk.gen";

export * from "./generated";
export { createClient, createConfig };
export type { Client, Config, RequestResult } from "./generated/client";

export const DEFAULT_BASE_URL = "https://api.rumoro.dev";

export interface RumoroOptions {
  /** API key from the dashboard or POST /v1/api-keys (ref_...). */
  apiKey: string;
  /** Another deployment's host; the hosted API by default. */
  baseUrl?: string;
  /** Custom fetch, for tests or runtimes without a global one. */
  fetch?: typeof fetch;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
}

/** Every SDK function, pre-bound to one client, plus the client itself for
 *  interceptors and raw requests. Passing `client` in a call still wins. */
export type Rumoro = typeof sdk & { client: Client };

export function createRumoro(options: RumoroOptions): Rumoro {
  const client = createClient(
    createConfig({
      baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      auth: () => options.apiKey,
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
    }),
  );
  const bound: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(sdk)) {
    if (typeof fn !== "function") continue;
    const call = fn as (callOptions: { client?: Client }) => unknown;
    bound[name] = (callOptions?: { client?: Client }) => call({ ...callOptions, client: callOptions?.client ?? client });
  }
  return { ...(bound as typeof sdk), client };
}
