import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    interactions: "src/interactions.ts",
    post: "src/post.ts",
    types: "src/types.ts",
    environment: "src/environment.ts",
    "rate-limiter": "src/rate-limiter.ts"
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.json",
  splitting: false,
  treeshake: true,
  bundle: true,
  minify: false
});
