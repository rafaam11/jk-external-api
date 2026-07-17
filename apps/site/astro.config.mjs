import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://rafaam11.github.io",
  base: "/jk-external-api",
  output: "static",
  integrations: [preact()],
});
