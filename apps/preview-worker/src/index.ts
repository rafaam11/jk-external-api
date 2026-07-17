import { createApp } from "./app.js";

export default {
  fetch(request, env, context) {
    const app = createApp({ fetcher: fetch, cache: caches.default, now: () => new Date(), waitUntil: (promise) => context.waitUntil(promise) });
    return app.fetch(request, env, context);
  },
} satisfies ExportedHandler<Env>;
