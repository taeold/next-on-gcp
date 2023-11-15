/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    isrMemoryCacheSize: 0, // disable default in-memory caching
    incrementalCacheHandlerPath: "../lib/rtdb-cache-2.js",
  },
  generateBuildId: async () => {
    return process.env.BUILD_ID || "local-build";
  },
};

module.exports = nextConfig;
