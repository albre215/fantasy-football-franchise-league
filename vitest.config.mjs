import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true
  },
  resolve: {
    alias: {
      "@": path.resolve(".")
    }
  }
});
