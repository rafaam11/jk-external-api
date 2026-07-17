import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.astro/**", "**/coverage/**", "**/generated/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/*.{ts,tsx,mts}"], rules: { "@typescript-eslint/consistent-type-imports": "error" } },
);
