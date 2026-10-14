import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.F1_DIST_DIR || '.next',
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
};
export default config;
