import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts", "src/types.ts", "src/environment.ts", "src/interactions.ts", "src/post.ts", "src/rate-limiter.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.json",
});
