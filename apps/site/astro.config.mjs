import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://rafaam11.github.io",
  base: "/k-skill-application",
  output: "static",
  integrations: [preact()],
});
