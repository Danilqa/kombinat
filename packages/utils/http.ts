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
}

interface HttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  networkErrorMessage?: string;
}

function withTimeout(init: RequestInit | undefined, timeoutMs: number): RequestInit {
  const timeout = AbortSignal.timeout(timeoutMs);
  return { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout };
}

export function createHttpClient({
  baseUrl = '',
  timeoutMs,
  networkErrorMessage,
}: HttpClientOptions = {}): HttpClient {
  async function send(path: string, init: RequestInit | undefined): Promise<Response> {
    const url = `${baseUrl}${path}`;
    const options = timeoutMs === undefined ? init : withTimeout(init, timeoutMs);
    if (networkErrorMessage === undefined) return fetch(url, options);
    try {
      return await fetch(url, options);
    } catch {
      throw new Error(networkErrorMessage);
    }
  }

  return {
    async request(path, schema, init) {
      return readResponse(await send(path, init), schema);
    },
  };
}

export const sameOriginApi = createHttpClient();
