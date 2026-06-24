import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    // Vitest owns unit tests; Playwright owns browser tests. Keep them apart.
    exclude: [
      "node_modules/**",
      "dist/**",
      "playwright-report/**",
      "test-results/**",
      "tests/widget/embed.test.ts",
      "tests/widget/accessibility.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      include: ["src/core/**/*.ts", "src/data/index.ts"],
      exclude: ["src/data/types.ts", "src/index.ts", "src/cli/**", "src/widget/**"],
      thresholds: {
        lines: 90,
        branches: 80,
        functions: 95,
        statements: 90,
        perFile: false,
      },
    },
  },
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@data": resolve(__dirname, "src/data"),
    },
  },
});
