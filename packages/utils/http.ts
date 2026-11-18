import { z } from 'zod';

export const errorBodySchema = z.object({ error: z.string() });

export async function readResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = errorBodySchema.safeParse(body);
    throw new Error(error.success ? error.data.error : `${response.status} ${response.statusText}`);
  }
  return schema.parse(body);
}

export interface HttpClient {
  request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T>;
  // Has no timeout. Null when the server answers with an error instead of a stream.
  openStream(path: string, init?: RequestInit): Promise<ReadableStream<Uint8Array> | null>;
}

interface HttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  networkErrorMessage?: string;
}

export function createHttpClient({
  baseUrl = '',
  timeoutMs,
  networkErrorMessage,
}: HttpClientOptions = {}): HttpClient {
  async function send(
    path: string,
    init: RequestInit | undefined,
    sendTimeoutMs: number | undefined,
  ): Promise<Response> {
    const url = `${baseUrl}${path}`;
    const options =
      sendTimeoutMs === undefined ? init : { ...init, signal: AbortSignal.timeout(sendTimeoutMs) };
    if (networkErrorMessage === undefined) return fetch(url, options);
    try {
      return await fetch(url, options);
    } catch {
      throw new Error(networkErrorMessage);
    }
  }

  return {
    async request(path, schema, init) {
      return readResponse(await send(path, init, timeoutMs), schema);
    },
    async openStream(path, init) {
      const response = await send(path, init, undefined);
      return response.ok ? response.body : null;
    },
  };
}

export const sameOriginApi = createHttpClient();
