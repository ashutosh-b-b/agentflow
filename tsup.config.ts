import { defineConfig } from "tsup";

/**
 * Library build config — produces `dist/index.{js,cjs,d.ts}` and the
 * matching `dist/adapters.{js,cjs,d.ts}` subpath bundle. CSS is concatenated
 * separately by `scripts/build-css.mjs` into `dist/styles.css` — see the
 * `build` script in package.json.
 *
 * Everything in `dependencies` and `peerDependencies` is left external so
 * consumers' bundlers can deduplicate (React in particular MUST be the same
 * copy as the host app).
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    adapters: "src/adapters/index.ts",
  },
  format: ["esm", "cjs"],
  dts: { resolve: false },
  // The project root tsconfig.json is a references-only file; use the app
  // config (moduleResolution: Bundler, jsx-runtime, etc.) for the library
  // build instead.
  tsconfig: "./tsconfig.app.json",
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false, // single file per entry; smaller .d.ts surface
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    /^react-markdown/,
    /^remark-/,
    "diff",
    /^highlight\.js/,
  ],
});
