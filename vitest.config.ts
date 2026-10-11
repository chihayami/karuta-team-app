import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "app/**/*.test.{ts,tsx}",
      "web/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "gas/**/*.test.ts",
    ],
    environment: "node",
  },
});
