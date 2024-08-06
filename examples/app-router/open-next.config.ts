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
        getByTag: async (_tag: string) => [],
        getByPath: async (_path: string) => [],
        getLastModified: async (_path: string, _lastModified?: number) => 0,
        writeTags: async (
          _tags: { tag: string; path: string; revalidatedAt?: number }[],
        ) => {},
        name: "cloudflare",
      }),
      queue: async () => ({
        send: async (_message: any) => {},
        name: "cloudflare",
      }),
      incrementalCache: async () => ({
        get: async (_key: string, _isFetch?: boolean) => ({
          value: {} as any,
        }),
        set: async (_key: string, _value: any, _isFetch?: boolean) => {},
        delete: async (_key: string) => {},
        name: "cloudflare",
      }),
    },
  },
  functions: {},
  buildCommand: "npx turbo build",
};

export default config;
export type Config = typeof config;
