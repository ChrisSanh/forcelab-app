import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      // Scientific / business logic and validation: the code ISO/IEC 25010 asks us to prove.
      include: [
        "src/lib/math/**/*.ts",
        "src/lib/progression/{analytics,matching,goalActions}.ts",
        "src/lib/validation/**/*.ts",
        // The HTTP security policy is a security decision, so it is covered too.
        "next.config.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90,
      },
    },
  },
});
