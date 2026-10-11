import "server-only";
import { version } from "../../../package.json";
import { assertBuildIdentity, readAppConfiguration } from "./environment";

export function getServerConfiguration() {
  const configuration = readAppConfiguration(process.env, version);
  assertBuildIdentity(configuration.release, {
    environment: process.env.APP_BUILD_ENVIRONMENT,
    gitSha: process.env.APP_BUILD_GIT_SHA,
    sourceVersion: process.env.APP_BUILD_SOURCE_VERSION,
    configRevision: process.env.APP_BUILD_CONFIG_REVISION,
  });
  return configuration;
}
