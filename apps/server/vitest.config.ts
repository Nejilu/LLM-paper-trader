import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@paper-trading/db": path.resolve(__dirname, "../../packages/db/src"),
      "@paper-trading/server-shared": path.resolve(__dirname, "../../packages/server/src")
    }
  }
});
