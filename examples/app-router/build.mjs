import * as esbuild from "esbuild";
import * as path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

let replaceRelativePlugin = {
  name: "replaceRelative",
  setup(build) {
    build.onResolve({ filter: /^\.\/node-environment$/ }, (args) => ({
      path: path.join(import.meta.dirname, "./shim-empty.mjs"),
    }));

    build.onResolve({ filter: /^\.\/require-hook$/ }, (args) => ({
      path: path.join(import.meta.dirname, "./shim-empty.mjs"),
    }));

    build.onResolve({ filter: /^\.\/node-polyfill-/ }, (args) => ({
      path: path.join(import.meta.dirname, "./shim-empty.mjs"),
    }));
  },
};

const result = await esbuild.build({
  entryPoints: [".open-next/server-functions/default/index.mjs"],
  bundle: true,
  outfile: "out.mjs",
  external: [
    // "critters",
    "@opentelemetry/api",
    // "react",
    // "react-dom",
    // "react-server-dom-turbopack/client.edge",
    // "react-server-dom-webpack/client.edge",
    // "react-server-dom-turbopack/server.edge",
    // "react-server-dom-turbopack/server.node",
    // "react-server-dom-webpack/server.edge",
    // "react-server-dom-webpack/server.node",
    "node:*",
    "module",
    "url",
    "path",
    "fs",
    "stream",
    "http",
    "https",
    "os",
    "tty",
    "util",
    "crypto",
    "events",
    "vm",
    "assert",
    "child_process",
    "worker_threads",
    "async_hooks",
    "net",
    "tls",
    "zlib",
    "busboy",
    // "./node-environment",
  ],
  alias: {
    "react-server-dom-turbopack/client.edge": "./shim-empty.mjs",
    "react-server-dom-webpack/client.edge": "./shim-empty.mjs",
    "react-server-dom-turbopack/server.edge": "./shim-empty.mjs",
    "react-server-dom-webpack/server.edge": "./shim-empty.mjs",
    "react-server-dom-turbopack/server.node": "./shim-empty.mjs",
    "react-server-dom-webpack/server.node": "./shim-empty.mjs",
    // "@opentelemetry/api": "./shim-opentelemetry.mjs",
    "react-dom/server.edge": "./shim-empty.mjs",
    "react-dom/static.edge": "./shim-empty.mjs",
    // critters: "./shim-empty.mjs",
    "@next/env": "./shim-env.mjs",
  },
  plugins: [replaceRelativePlugin],
  format: "esm",
  target: "esnext",
  minify: false,
  define: {
    // "process.env.NEXT_RUNTIME": '"edge"',
    "process.env.NEXT_RUNTIME": '"nodejs"',
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_MINIMAL": "true",
    // "process.env.NEXT_MINIMAL": "false",
    "process.env.NEXT_PRIVATE_MINIMAL_MODE": "true",
    // "process.env.NEXT_PRIVATE_MINIMAL_MODE": "false",
    __dirname: '""',
    __non_webpack_require__: "require",
    "globalThis.__NEXT_HTTP_AGENT": "{}",
  },
  platform: "browser",
  conditions: ["workerd", "worker", "browser"],
  metafile: true,
});

let contents = readFileSync("./out.mjs", "utf-8");

contents = contents
  .replace(/__require\d?\(/g, "require(")
  .replace(/__require\d?\./g, "require.");

contents = contents.replace(
  "this.buildId = this.getBuildId();",
  "this.buildId = BuildId;",
);

contents = contents.replace(
  /function loadManifest\((.+?), .+?\) {/,
  `$&
  if ($1.endsWith(".next/server/app-paths-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/server/app-paths-manifest.json",
      "utf-8",
    )}
  }
  if ($1.endsWith(".next/server/next-font-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/server/next-font-manifest.json",
      "utf-8",
    )}
  }
  if ($1.endsWith(".next/prerender-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/prerender-manifest.json",
      "utf-8",
    )}
  }
  if ($1.endsWith(".next/server/font-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/server/font-manifest.json",
      "utf-8",
    )}
  }
  if ($1.endsWith(".next/server/pages-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/server/pages-manifest.json",
      "utf-8",
    )}
  }
  if ($1.endsWith(".next/routes-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/routes-manifest.json",
      "utf-8",
    )}
  }
  if ($1.endsWith(".next/build-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/build-manifest.json",
      "utf-8",
    )}
  }
  if ($1.endsWith(".next/react-loadable-manifest.json")) {
    return ${readFileSync(
      ".open-next/server-functions/default/examples/app-router/.next/react-loadable-manifest.json",
      "utf-8",
    )}
  }
  throw new Error("Unknown manifest: " + $1);
  `,
);

const openNextConfig = readFileSync(
  ".open-next/server-functions/default/examples/app-router/open-next.config.mjs",
  "utf-8",
).match(/ config = {.+?};/s)[0];

contents = contents.replace(/ config = await import\(.+?;/, openNextConfig);

contents = contents.replace(
  /if \(cacheHandler\) {.+?CacheHandler = .+?}/s,
  `
  CacheHandler = class CustomCacheHandler {
    constructor(ctx) {
      this.cache = Object.create(null);
    }
    async get(key, ctx) {
      return {
        value: cache[key] ?? null
      }
    }
    async set (key, data, ctx) {
      cache[key] = data;
    }
    async revalidateTag(tags) {
      console.log('revalidateTag', tags);
    }
    resetRequestCache() {
      console.log('resetRequestCache');
    }
  }
  `,
);

contents = contents.replace(
  /const pagePath = getPagePath\(.+?\);/,
  `$&
  if (pagePath.endsWith(".next/server/pages/404.html")) {
    return ${JSON.stringify(
      readFileSync(
        "./.open-next/server-functions/default/examples/app-router/.next/server/pages/404.html",
        "utf-8",
      ),
    )};
  }
  if (pagePath.endsWith(".next/server/pages/_document.js")) {
    return require("./.open-next/server-functions/default/examples/app-router/.next/server/pages/_document.js");
  }
  if (pagePath.endsWith(".next/server/pages/_app.js")) {
    return require("./.open-next/server-functions/default/examples/app-router/.next/server/pages/_app.js");
  }
  if (pagePath.endsWith(".next/server/pages/_error.js")) {
    return require("./.open-next/server-functions/default/examples/app-router/.next/server/pages/_error.js");
  }
  if (pagePath.endsWith(".next/server/app/_not-found.js")) {
    return require("./.open-next/server-functions/default/examples/app-router/.next/server/app/_not-found.js");
  }
  if (pagePath.endsWith(".next/server/app/api/host/route.js")) {
    return require("./.open-next/server-functions/default/examples/app-router/.next/server/app/api/host/route.js");
  }
  if (pagePath.endsWith(".next/server/app/api/client/route.js")) {
    return require("./.open-next/server-functions/default/examples/app-router/.next/server/app/api/client/route.js");
  }
  `,
);

contents = contents.replace(
  / ([a-zA-Z0-9_]+) = require\("url"\);/g,
  ` $1 = require("url");
    const origParse = $1.parse;
    $1.parse = (a, b, c) => a.startsWith("/") ? { query: Object.create(null), pathname: a, path: a, href: a } : origParse(a, b, c);
    const origFormat = $1.format;
    $1.format = (a, b) => a?.pathname ? a.pathname : origFormat(a, b);
  `,
);

contents = contents.replace(
  "function findDir(dir, name) {",
  `function findDir(dir, name) {
    if (dir.endsWith(".next/server") && (name === "app" || name === "pages")) return true;
`,
);

writeFileSync("./out.mjs", contents);

writeFileSync("./meta.json", JSON.stringify(result.metafile, null, 2));

const globalUtilsFile =
  "./.open-next/server-functions/default/node_modules/@opentelemetry/api/build/src/internal/global-utils.js";
writeFileSync(
  globalUtilsFile,
  readFileSync(globalUtilsFile, "utf-8").replace(
    '= require("../platform");',
    '= require("../platform/index");',
  ),
);

const webpackRuntimeFile =
  "./.open-next/server-functions/default/examples/app-router/.next/server/webpack-runtime.js";
writeFileSync(
  webpackRuntimeFile,
  readFileSync(webpackRuntimeFile, "utf-8").replace(
    "__webpack_require__.f.require = (chunkId, promises) => {",
    `__webpack_require__.f.require = (chunkId, promises) => {
      if (installedChunks[chunkId]) return;
      if (chunkId === 72) {
        installChunk(require("./chunks/72.js"));
        return;
      }
      if (chunkId === 638) {
        installChunk(require("./chunks/638.js"));
        return;
      }
      if (chunkId === 719) {
        installChunk(require("./chunks/719.js"));
        return;
      }
      if (chunkId === 791) {
        installChunk(require("./chunks/791.js"));
        return;
      }
    `,
  ),
);
