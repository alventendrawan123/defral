/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // viem's tempo chain uses a dynamic require() that webpack can't statically
    // analyse. It only affects the tempo chain definition — never used here.
    // Suppress the noisy-but-harmless "Critical dependency" warning.
    config.module = config.module ?? {};
    config.module.exprContextCritical = false;
    return config;
  },
};

module.exports = nextConfig;
