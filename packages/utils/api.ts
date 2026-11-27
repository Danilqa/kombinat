import ky, { isHTTPError, type KyInstance } from 'ky';
import { z } from 'zod';

const errorBodySchema = z.object({ error: z.string() });

export type Api = KyInstance;

interface ApiOptions {
  baseUrl?: string;
  timeoutMs?: number;
  networkErrorMessage?: string;
}

export function createApi({ baseUrl, timeoutMs, networkErrorMessage }: ApiOptions = {}): Api {
  return ky.create({
    // Not ky's baseUrl, which drops a path in the base URL when a request path starts with a slash.
    prefix: baseUrl,
    // ky retries a failed GET twice by default. A failure reaches the caller at once.
    retry: 0,
    // ky gives up after 10 seconds by default, which the first GET /api/releases can take.
    // A caller's limit covers the whole request, the body too.
    timeout: false,
    totalTimeout: timeoutMs ?? false,
    hooks: {
      beforeError: [
        ({ error }) => {
          if (isHTTPError(error)) {
            const body = errorBodySchema.safeParse(error.data);
            error.message = body.success
              ? body.data.error
              : `${error.response.status} ${error.response.statusText}`;
            return error;
          }
          return networkErrorMessage === undefined
            ? error
            : new Error(networkErrorMessage, { cause: error });
        },
      ],
    },
  });
}
