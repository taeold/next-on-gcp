/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    isrMemoryCacheSize: 0, // disable default in-memory caching
  },
};

module.exports = nextConfig;
