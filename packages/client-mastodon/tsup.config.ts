import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: {
    resolve: true,
  },
  sourcemap: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.json",
  splitting: false,
  treeshake: true,
  bundle: true,
  minify: false
});
