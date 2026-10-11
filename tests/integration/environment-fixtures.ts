import type {
  AppEnvironment,
  DeploymentTarget,
} from "../../web/src/platform/environment";

export const TEST_BINDINGS = {
  development: {
    origin: "https://development.members.example.org",
    supabaseProjectRef: "aaaaaaaaaaaaaaaaaaaa",
    lineChannelId: "1000000001",
    liffId: "1000000001-devExample",
    gasDeploymentId: "development-example",
  },
  production: {
    origin: "https://members.example.org",
    supabaseProjectRef: "bbbbbbbbbbbbbbbbbbbb",
    lineChannelId: "1000000002",
    liffId: "1000000002-prodExample",
    gasDeploymentId: "production-example",
  },
};

export function environmentFixture(
  environment: AppEnvironment = "development",
  target: DeploymentTarget = "preview",
): Record<string, string> {
  const expected = TEST_BINDINGS[environment];
  return {
    APP_ENVIRONMENT: environment,
    APP_DEPLOYMENT_TARGET: target,
    APP_ORIGIN: target === "local" ? "http://localhost:3000" : expected.origin,
    APP_SUPABASE_URL: `https://${expected.supabaseProjectRef}.supabase.co`,
    APP_LINE_CHANNEL_ID: expected.lineChannelId,
    APP_LIFF_ID: expected.liffId,
    APP_GAS_DEPLOYMENT_ID: expected.gasDeploymentId,
    APP_ENVIRONMENT_BINDINGS: JSON.stringify(TEST_BINDINGS),
    APP_GIT_SHA: "abcdef1".padEnd(40, "0"),
    APP_CONFIG_REVISION: "test-1",
  };
}
