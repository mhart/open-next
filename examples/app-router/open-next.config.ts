const config = {
  dangerous: {
    disableIncrementalCache: true,
    disableTagCache: true,
  },
  disableWarmerFunction: true,
  disableRevalidateFunction: true,
  disableOptimizationFunction: true,
  imageOptimization: { loader: "host" },
  default: {
    // runtime: "edge",
    runtime: "node",
    placement: "global",
    minify: false,
    debug: true,
    override: {
      wrapper: "cloudflare", // src/wrappers/
      converter: "edge", // src/converters/
      tagCache: async () => ({
        getByTag: async (tag: string) => [],
        getByPath: async (path: string) => [],
        getLastModified: async (path: string, lastModified?: number) => 0,
        writeTags: async (
          tags: { tag: string; path: string; revalidatedAt?: number }[],
        ) => {},
        name: "cloudflare",
      }),
      queue: async () => ({
        send: async (message: any) => {},
        name: "cloudflare",
      }),
      incrementalCache: async () => ({
        get: async (key: string, isFetch?: boolean) => ({
          value: {} as any,
        }),
        set: async (key: string, value: any, isFetch?: boolean) => {},
        delete: async (key: string) => {},
        name: "cloudflare",
      }),
    },
  },
  functions: {},
  buildCommand: "npx turbo build",
};

export default config;
export type Config = typeof config;
