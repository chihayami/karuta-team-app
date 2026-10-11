import { fileURLToPath } from "node:url";
import packageMetadata from "../package.json" with { type: "json" };
import { readAppConfiguration } from "./src/platform/environment.ts";

const { release } = readAppConfiguration(process.env, packageMetadata.version);

/** @type {import("next").NextConfig} */
const config = {
  poweredByHeader: false,
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  // Only non-secret build identity is embedded. Service settings stay on the server.
  env: {
    APP_BUILD_ENVIRONMENT: release.environment,
    APP_BUILD_GIT_SHA: release.gitSha,
    APP_BUILD_SOURCE_VERSION: release.sourceVersion,
    APP_BUILD_CONFIG_REVISION: release.configRevision,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default config;
