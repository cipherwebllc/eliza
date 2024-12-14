import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: {
    entry: {
      index: "src/index.ts"
    },
    compilerOptions: {
      moduleResolution: "node16",
      paths: {
        "@ai16z/*": ["../../packages/*/src"]
      },
      declaration: true,
      emitDeclarationOnly: true
    }
  },
  sourcemap: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.json",
  splitting: false,
  treeshake: true,
  bundle: true,
  minify: false,
  outDir: "dist"
});
