import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": root("."),
      // `server-only` tira error fuera del bundler de Next; se neutraliza en los tests.
      "server-only": root("tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
})
