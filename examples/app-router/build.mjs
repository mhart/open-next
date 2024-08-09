import * as esbuild from "esbuild";
import * as path from "node:path";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  globSync,
  existsSync,
} from "node:fs";

let MONOREPO_ROOT = ".";
while (!existsSync(MONOREPO_ROOT + "/pnpm-workspace.yaml")) {
  MONOREPO_ROOT = MONOREPO_ROOT + "/..";
}

const openNextOutput = JSON.parse(
  readFileSync(".open-next/open-next.output.json", "utf-8"),
);
const BASE_DIR = openNextOutput.origins.default.bundle; // .open-next/server-functions/default
const APP_BASE_DIR =
  BASE_DIR +
  "/" +
  readFileSync(BASE_DIR + "/index.mjs", "utf-8").match(
    /from "\.\/(.+)\/index.mjs"/,
  )[1]; // .open-next/server-functions/default/examples/app-router
const NEXT_DIR = APP_BASE_DIR + "/.next";
const NEXT_SERVER_DIR = NEXT_DIR + "/server";

let replaceRelativePlugin = {
  name: "replaceRelative",
  setup(build) {
    // Can't use custom require hook
    build.onResolve({ filter: /^\.\/require-hook$/ }, (args) => ({
      path: path.join(import.meta.dirname, "./shim-empty.mjs"),
    }));
    // No need for edge-runtime sandbox
    build.onResolve({ filter: /\.\/web\/sandbox$/ }, (args) => ({
      path: path.join(import.meta.dirname, "./shim-empty.mjs"),
    }));
    // // No need for supporting previews and jsonwebtoken
    build.onResolve(
      { filter: /\.\/api-utils\/node\/try-get-preview-data$/ },
      (args) => ({
        path: path.join(import.meta.dirname, "./shim-try-get-preview-data.mjs"),
      }),
    );
  },
};

const result = await esbuild.build({
  entryPoints: [BASE_DIR + "/index.mjs"],
  bundle: true,
  outfile: "out.mjs",
  alias: {
    "next/dist/experimental/testmode/server": "./shim-empty.mjs",
    "next/dist/compiled/ws": "./shim-empty.mjs",
    "@next/env": "./shim-env.mjs",
  },
  plugins: [replaceRelativePlugin],
  format: "esm",
  target: "esnext",
  minify: false,
  define: {
    "process.env.NEXT_RUNTIME": '"nodejs"',
    __dirname: '""',
    "globalThis.__NEXT_HTTP_AGENT": "{}",
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_MINIMAL": "true",
    "process.env.NEXT_PRIVATE_MINIMAL_MODE": "true",
    __non_webpack_require__: "require",
  },
  platform: "node",
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
  "getBuildId() {",
  `getBuildId() {
    return ${JSON.stringify(
      readFileSync(NEXT_DIR + "/BUILD_ID", "utf-8").trim(),
    )};
  `,
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

const openNextConfig = readFileSync(
  APP_BASE_DIR + "/open-next.config.mjs",
  "utf-8",
).match(/ config = {.+?};/s)[0];

contents = contents.replace(/ config = await import\(.+?;/, openNextConfig);

const pagesManifestFile = NEXT_SERVER_DIR + "/pages-manifest.json";
const appPathsManifestFile = NEXT_SERVER_DIR + "/app-paths-manifest.json";

const pagesManifestFiles = existsSync(pagesManifestFile)
  ? Object.values(JSON.parse(readFileSync(pagesManifestFile, "utf-8"))).map(
      (file) => ".next/server/" + file,
    )
  : [];
const appPathsManifestFiles = existsSync(appPathsManifestFile)
  ? Object.values(JSON.parse(readFileSync(appPathsManifestFile, "utf-8"))).map(
      (file) => ".next/server/" + file,
    )
  : [];
const allManifestFiles = pagesManifestFiles.concat(appPathsManifestFiles);

const htmlPages = allManifestFiles.filter((file) => file.endsWith(".html"));
const pageModules = allManifestFiles.filter((file) => file.endsWith(".js"));

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

contents = contents.replace(
  /if \(cacheHandler\) {.+?CacheHandler = .+?}/s,
  `
  CacheHandler = null;
  `,
);

contents = contents.replace(
  / ([a-zA-Z0-9_]+) = require\("url"\);/g,
  ` $1 = require("url");
    const origParse = $1.parse;
    $1.parse = (urlString, parseQueryString, slashesDenoteHost) => {
      console.log("url.parse", urlString, parseQueryString, slashesDenoteHost);
      if (urlString.startsWith("/") && !slashesDenoteHost) {
        const url = new URL("http://localhost" + urlString);
        return {
          search: url.search,
          query: parseQueryString ? Object.fromEntries(url.searchParams) : url.search.slice(1),
          pathname: url.pathname,
          path: url.pathname + url.search,
          href: url.pathname + url.search
        }
      }
      return origParse(urlString, parseQueryString, slashesDenoteHost);
    }
    const origFormat = $1.format;
    $1.format = (a, b) => {
      console.log("url.format", a, b);
      return a?.pathname ? a.pathname.replace("?", "%3F") : origFormat(a, b);
    }
    $1.pathToFileURL = (path) => {
      console.log("url.pathToFileURL", path);
      return new URL("file://" + path);
    }
  `,
);

const HAS_APP_DIR = existsSync(NEXT_SERVER_DIR + "/app");
const HAS_PAGES_DIR = existsSync(NEXT_SERVER_DIR + "/pages");

contents = contents.replace(
  "function findDir(dir, name) {",
  `function findDir(dir, name) {
    if (dir.endsWith(".next/server")) {
      if (name === "app") return ${HAS_APP_DIR};
      if (name === "pages") return ${HAS_PAGES_DIR};
    }
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

contents = contents.replace(
  /var NodeModuleLoader = class {.+?async load\((.+?)\) {/s,
  `$&
  ${pageModules
    .map(
      (module) => `
        if ($1.endsWith("${module}")) {
          return require("./${APP_BASE_DIR}/${module}");
        }
      `,
    )
    .join("\n")}
  throw new Error("Unknown NodeModuleLoader: " + $1);
  `,
);

writeFileSync("./out.mjs", contents);

writeFileSync("./meta.json", JSON.stringify(result.metafile, null, 2));

const cloudflareAssetsFile =
  MONOREPO_ROOT + "/node_modules/@cloudflare/kv-asset-handler/dist/index.js";
writeFileSync(
  cloudflareAssetsFile,
  readFileSync(cloudflareAssetsFile, "utf-8").replace(
    'const mime = __importStar(require("mime"));',
    'let mime = __importStar(require("mime")); mime = mime.default ?? mime;',
  ),
);

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

const unenvProcessFiles = [
  MONOREPO_ROOT + "/node_modules/unenv/runtime/node/process/$cloudflare.cjs",
  MONOREPO_ROOT + "/node_modules/unenv/runtime/node/process/$cloudflare.mjs",
];
for (const unenvProcessFile of unenvProcessFiles) {
  writeFileSync(
    unenvProcessFile,
    readFileSync(unenvProcessFile, "utf-8").replace(
      'const unpatchedGlobalThisProcess = globalThis["process"];',
      'const processKey = "process"; const unpatchedGlobalThisProcess = globalThis[processKey];',
    ),
  );
}
