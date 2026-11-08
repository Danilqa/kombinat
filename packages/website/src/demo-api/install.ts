import { createDemoApi } from './api';

// The dashboard calls the daemon at /api on its own origin, so the demo answers those calls in the browser.
export function installDemoApi(): void {
  const api = createDemoApi();
  const fetchFromNetwork = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return fetchFromNetwork(input, init);
    }
    const { status, body } = api.respond(request.method, url);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );
  };
}
