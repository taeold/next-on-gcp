/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    isrMemoryCacheSize: 0, // disable default in-memory caching
    incrementalCacheHandlerPath: require.resolve("./rtdb-cache.js"),
  },
  generateBuildId: async () => {
    return process.env.BUILD_ID || "deadbeef";
  },
};

module.exports = nextConfig;
