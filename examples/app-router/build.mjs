import * as esbuild from "esbuild";
import * as path from "node:path";
import { readFileSync, writeFileSync, readdirSync, globSync } from "node:fs";

const BASE_DIR = ".open-next/server-functions/default";
const APP_BASE_DIR = BASE_DIR + "/examples/app-router";
const NEXT_DIR = APP_BASE_DIR + "/.next";
const NEXT_SERVER_DIR = NEXT_DIR + "/server";

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
  entryPoints: [BASE_DIR + "/index.mjs"],
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
    // "react-server-dom-turbopack/client.edge": "./shim-empty.mjs",
    // "react-server-dom-webpack/client.edge": "./shim-empty.mjs",
    // "react-server-dom-turbopack/server.edge": "./shim-empty.mjs",
    // "react-server-dom-webpack/server.edge": "./shim-empty.mjs",
    // "react-server-dom-turbopack/server.node": "./shim-empty.mjs",
    // "react-server-dom-webpack/server.node": "./shim-empty.mjs",
    // "react-dom/server.edge": "./shim-empty.mjs",
    // "react-dom/static.edge": "./shim-empty.mjs",
    // "@opentelemetry/api": "./shim-opentelemetry.mjs",
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
  banner: {
    js: `
      globalThis.setImmediate ??= (c) => setTimeout(c, 0);
    `,
  },
});

let contents = readFileSync("./out.mjs", "utf-8");

contents = contents
  .replace(/__require\d?\(/g, "require(")
  .replace(/__require\d?\./g, "require.");

contents = contents.replace(
  "this.buildId = this.getBuildId();",
  "this.buildId = BuildId;",
);

const manifestJsons = globSync(NEXT_DIR + "/**/*-manifest.json").map((file) =>
  file.replace(APP_BASE_DIR + "/", ""),
);

contents = contents.replace(
  /function loadManifest\((.+?), .+?\) {/,
  `$&
  ${manifestJsons
    .map(
      (manifestJson) => `
        if ($1.endsWith("${manifestJson}")) {
          return ${readFileSync(APP_BASE_DIR + "/" + manifestJson, "utf-8")};
        }
      `,
    )
    .join("\n")}
  throw new Error("Unknown loadManifest: " + $1);
  `,
);

const htmlPages = globSync(NEXT_SERVER_DIR + "/pages/*.html").map((file) =>
  file.replace(APP_BASE_DIR + "/", ""),
);

const pageModules = [
  globSync(NEXT_SERVER_DIR + "/pages/*.js"),
  globSync(NEXT_SERVER_DIR + "/app/**/page.js"),
  globSync(NEXT_SERVER_DIR + "/app/**/route.js"),
  globSync(NEXT_SERVER_DIR + "/app/**/_not-found.js"),
]
  .flat()
  .map((file) => file.replace(APP_BASE_DIR + "/", ""));

contents = contents.replace(
  /const pagePath = getPagePath\(.+?\);/,
  `$&
  ${htmlPages
    .map(
      (htmlPage) => `
        if (pagePath.endsWith("${htmlPage}")) {
          return ${JSON.stringify(
            readFileSync(APP_BASE_DIR + "/" + htmlPage, "utf-8"),
          )};
        }
      `,
    )
    .join("\n")}
  ${pageModules
    .map(
      (module) => `
        if (pagePath.endsWith("${module}")) {
          return require("./${APP_BASE_DIR}/${module}");
        }
      `,
    )
    .join("\n")}
  throw new Error("Unknown pagePath: " + pagePath);
  `,
);

const manifestJss = globSync(
  NEXT_DIR + "/**/*_client-reference-manifest.js",
).map((file) => file.replace(APP_BASE_DIR + "/", ""));

contents = contents.replace(
  /function evalManifest\((.+?), .+?\) {/,
  `$&
  ${manifestJss
    .map(
      (manifestJs) => `
        if ($1.endsWith("${manifestJs}")) {
          require("./${APP_BASE_DIR}/${manifestJs}");
          return {
            __RSC_MANIFEST: {
              "${manifestJs
                .replace(".next/server/app", "")
                .replace(
                  "_client-reference-manifest.js",
                  "",
                )}": globalThis.__RSC_MANIFEST["${manifestJs
        .replace(".next/server/app", "")
        .replace("_client-reference-manifest.js", "")}"],
            },
          };
        }
      `,
    )
    .join("\n")}
  throw new Error("Unknown evalManifest: " + $1);
  `,
);

const openNextConfig = readFileSync(
  APP_BASE_DIR + "/open-next.config.mjs",
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
      this.cache = Object.create(null);
    }
  }
  `,
);

contents = contents.replace(
  / ([a-zA-Z0-9_]+) = require\("url"\);/g,
  ` $1 = require("url");
    const origParse = $1.parse;
    $1.parse = (a, b, c) => {
      console.log("url.parse", a, b, c);
      return a.startsWith("/") ? { query: Object.create(null), pathname: a, path: a, href: a } : origParse(a, b, c);
    }
    const origFormat = $1.format;
    $1.format = (a, b) => {
      console.log("url.format", a, b);
      return a?.pathname ? a.pathname.replace("?", "%3F") : origFormat(a, b);
    }
  `,
);

contents = contents.replace(
  "function findDir(dir, name) {",
  `function findDir(dir, name) {
    if (dir.endsWith(".next/server") && (name === "app" || name === "pages")) return true;
    throw new Error("Unknown findDir call: " + dir + " " + name);
`,
);

contents = contents.replace(
  "async function loadClientReferenceManifest(manifestPath, entryName) {",
  `async function loadClientReferenceManifest(manifestPath, entryName) {
    const context = await evalManifestWithRetries(manifestPath);
    return context.__RSC_MANIFEST[entryName];
`,
);

writeFileSync("./out.mjs", contents);

writeFileSync("./meta.json", JSON.stringify(result.metafile, null, 2));

const globalUtilsFile =
  BASE_DIR +
  "/node_modules/@opentelemetry/api/build/src/internal/global-utils.js";
writeFileSync(
  globalUtilsFile,
  readFileSync(globalUtilsFile, "utf-8").replace(
    '= require("../platform");',
    '= require("../platform/index");',
  ),
);

const chunks = readdirSync(NEXT_SERVER_DIR + "/chunks").map((chunk) =>
  chunk.replace(/\.js$/, ""),
);
const webpackRuntimeFile = NEXT_SERVER_DIR + "/webpack-runtime.js";
writeFileSync(
  webpackRuntimeFile,
  readFileSync(webpackRuntimeFile, "utf-8").replace(
    "__webpack_require__.f.require = (chunkId, promises) => {",
    `__webpack_require__.f.require = (chunkId, promises) => {
      if (installedChunks[chunkId]) return;
      ${chunks
        .map(
          (chunk) => `
        if (chunkId === ${chunk}) {
          installChunk(require("./chunks/${chunk}.js"));
          return;
        }
      `,
        )
        .join("\n")}
    `,
  ),
);

const cloudflareAssetsFile =
  "../../node_modules/@cloudflare/kv-asset-handler/dist/index.js";
writeFileSync(
  cloudflareAssetsFile,
  readFileSync(cloudflareAssetsFile, "utf-8").replace(
    'const mime = __importStar(require("mime"));',
    'let mime = __importStar(require("mime")); mime = mime.default ?? mime;',
  ),
);
