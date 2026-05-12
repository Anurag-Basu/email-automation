import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory that holds this config file = repo root (stable even if cwd is wrong). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfkit"],
  // Critical when multiple lockfiles exist (e.g. parent ~/package-lock.json): without this,
  // Turbopack can infer the wrong root and watch huge trees → CPU/RAM spike and OS freeze.
  turbopack: {
    root: projectRoot,
  },
  // Applies when dev runs with webpack (`npm run dev:webpack`). Turbopack uses its own watcher;
  // pinning `turbopack.root` above is what stops runaway watching across lockfile boundaries.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.data/**",
          "**/.next/**",
          "**/.cursor/**",
          "**/coverage/**",
          "**/dist/**",
          "**/.DS_Store",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
