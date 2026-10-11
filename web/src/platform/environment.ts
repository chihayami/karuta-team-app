export type AppEnvironment = "development" | "production";
export type DeploymentTarget = "local" | "preview" | "production";

export interface EnvironmentBinding {
  readonly origin: string;
  readonly supabaseProjectRef: string;
  readonly lineChannelId: string;
  readonly liffId: string;
  readonly gasDeploymentId: string;
}

export interface ReleaseInfo {
  readonly environment: AppEnvironment;
  readonly sourceVersion: string;
  readonly gitSha: string;
  readonly displayVersion: string;
  readonly configRevision: string;
}

export interface AppConfiguration {
  readonly deploymentTarget: DeploymentTarget;
  readonly origin: string;
  readonly services: EnvironmentBinding;
  readonly release: ReleaseInfo;
}

export class ConfigurationError extends Error {
  constructor(field: string, reason: string) {
    // Never include input values: a malformed setting may contain credentials.
    super(`Invalid configuration: ${field} (${reason})`);
    this.name = "ConfigurationError";
  }
}

function text(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new ConfigurationError(field, "non-empty string required");
  }
  return value;
}

function matching(value: unknown, field: string, pattern: RegExp): string {
  const result = text(value, field);
  if (!pattern.test(result)) {
    throw new ConfigurationError(field, "invalid format");
  }
  return result;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConfigurationError(field, "object required");
  }
  return value as Record<string, unknown>;
}

function origin(value: unknown, field: string, allowLoopback: boolean): string {
  const raw = text(value, field);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigurationError(field, "origin required");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const validProtocol =
    url.protocol === "https:" ||
    (allowLoopback && loopback && url.protocol === "http:");
  if (
    !validProtocol ||
    (!allowLoopback && loopback) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    raw !== url.origin
  ) {
    throw new ConfigurationError(
      field,
      "HTTPS origin required; HTTP loopback is local only",
    );
  }
  return url.origin;
}

const IDENTIFIER = /^[A-Za-z0-9_-]{1,160}$/;
const PROJECT_REF = /^[a-z0-9]{20}$/;
const CHANNEL_ID = /^[0-9]{1,20}$/;
const LIFF_ID = /^[0-9]{1,20}-[A-Za-z0-9]{1,80}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const SOURCE_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function binding(value: unknown, field: string): EnvironmentBinding {
  const input = record(value, field);
  const result = {
    origin: origin(input.origin, `${field}.origin`, false),
    supabaseProjectRef: matching(
      input.supabaseProjectRef,
      `${field}.supabaseProjectRef`,
      PROJECT_REF,
    ),
    lineChannelId: matching(
      input.lineChannelId,
      `${field}.lineChannelId`,
      CHANNEL_ID,
    ),
    liffId: matching(input.liffId, `${field}.liffId`, LIFF_ID),
    gasDeploymentId: matching(
      input.gasDeploymentId,
      `${field}.gasDeploymentId`,
      IDENTIFIER,
    ),
  };
  return Object.freeze(result);
}

function bindings(value: unknown): Record<AppEnvironment, EnvironmentBinding> {
  const field = "APP_ENVIRONMENT_BINDINGS";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text(value, field));
  } catch {
    throw new ConfigurationError(field, "valid JSON required");
  }
  const input = record(parsed, field);
  const development = binding(input.development, `${field}.development`);
  const production = binding(input.production, `${field}.production`);
  const keys: (keyof EnvironmentBinding)[] = [
    "origin",
    "supabaseProjectRef",
    "lineChannelId",
    "liffId",
    "gasDeploymentId",
  ];
  for (const key of keys) {
    if (development[key] === production[key]) {
      throw new ConfigurationError(field, `${key} must be separated`);
    }
  }
  return { development, production };
}

export function readAppConfiguration(
  input: Readonly<Record<string, unknown>>,
  sourceVersion: unknown,
): AppConfiguration {
  const environment = text(input.APP_ENVIRONMENT, "APP_ENVIRONMENT");
  if (environment !== "development" && environment !== "production") {
    throw new ConfigurationError("APP_ENVIRONMENT", "unsupported environment");
  }
  const target = text(input.APP_DEPLOYMENT_TARGET, "APP_DEPLOYMENT_TARGET");
  if (target !== "local" && target !== "preview" && target !== "production") {
    throw new ConfigurationError("APP_DEPLOYMENT_TARGET", "unsupported target");
  }
  if ((target === "production") !== (environment === "production")) {
    throw new ConfigurationError(
      "APP_DEPLOYMENT_TARGET",
      "environment mismatch",
    );
  }
  const expectedVercelEnvironment = target === "local" ? "development" : target;
  if (
    (input.VERCEL !== undefined && input.VERCEL !== "1") ||
    (input.VERCEL === "1" && input.VERCEL_ENV === undefined) ||
    (input.VERCEL_ENV !== undefined &&
      input.VERCEL_ENV !== expectedVercelEnvironment) ||
    (input.VERCEL_TARGET_ENV !== undefined &&
      input.VERCEL_TARGET_ENV !== expectedVercelEnvironment)
  ) {
    throw new ConfigurationError("VERCEL_ENV", "deployment target mismatch");
  }
  if (input.VERCEL_GIT_COMMIT_REF !== undefined) {
    const branch = text(input.VERCEL_GIT_COMMIT_REF, "VERCEL_GIT_COMMIT_REF");
    if (
      (target === "production" && branch !== "main") ||
      (target === "preview" &&
        !/^(develop|(feature|fix|docs|chore|hotfix)\/[a-z0-9-]+)$/.test(branch))
    ) {
      throw new ConfigurationError("VERCEL_GIT_COMMIT_REF", "branch mismatch");
    }
  }

  const services = bindings(input.APP_ENVIRONMENT_BINDINGS)[environment];
  const appOrigin = origin(input.APP_ORIGIN, "APP_ORIGIN", target === "local");
  if (target === "local") {
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(new URL(appOrigin).hostname)
    ) {
      throw new ConfigurationError(
        "APP_ORIGIN",
        "local target requires loopback",
      );
    }
  } else if (appOrigin !== services.origin) {
    throw new ConfigurationError("APP_ORIGIN", "environment binding mismatch");
  }
  const checks: [string, string][] = [
    ["APP_SUPABASE_URL", `https://${services.supabaseProjectRef}.supabase.co`],
    ["APP_LINE_CHANNEL_ID", services.lineChannelId],
    ["APP_LIFF_ID", services.liffId],
    ["APP_GAS_DEPLOYMENT_ID", services.gasDeploymentId],
  ];
  for (const [field, expected] of checks) {
    if (text(input[field], field) !== expected) {
      throw new ConfigurationError(field, "environment binding mismatch");
    }
  }

  const version = matching(
    sourceVersion,
    "package.json.version",
    SOURCE_VERSION,
  );
  const usesVercelGitSha = input.APP_GIT_SHA === undefined;
  const gitShaSource = usesVercelGitSha
    ? "VERCEL_GIT_COMMIT_SHA"
    : "APP_GIT_SHA";
  const gitSha = matching(
    usesVercelGitSha ? input.VERCEL_GIT_COMMIT_SHA : input.APP_GIT_SHA,
    gitShaSource,
    GIT_SHA,
  );
  if (
    target !== "local" &&
    (new URL(appOrigin).hostname.endsWith(".invalid") || /^0+$/.test(gitSha))
  ) {
    throw new ConfigurationError(
      "deployment",
      "local placeholders cannot be deployed",
    );
  }
  if (
    input.VERCEL_GIT_COMMIT_SHA !== undefined &&
    input.VERCEL_GIT_COMMIT_SHA !== gitSha
  ) {
    throw new ConfigurationError("APP_GIT_SHA", "deployment SHA mismatch");
  }
  const configRevision = matching(
    input.APP_CONFIG_REVISION,
    "APP_CONFIG_REVISION",
    IDENTIFIER,
  );
  const release = Object.freeze({
    environment,
    sourceVersion: version,
    gitSha,
    displayVersion:
      environment === "development"
        ? `${version}-dev.${gitSha.slice(0, 7)}`
        : version,
    configRevision,
  });
  return Object.freeze({
    deploymentTarget: target,
    origin: appOrigin,
    services,
    release,
  });
}

export interface BuildIdentity {
  readonly environment: unknown;
  readonly gitSha: unknown;
  readonly sourceVersion: unknown;
  readonly configRevision: unknown;
}

export function assertBuildIdentity(
  release: ReleaseInfo,
  built: BuildIdentity,
): void {
  for (const key of [
    "environment",
    "gitSha",
    "sourceVersion",
    "configRevision",
  ] as const) {
    if (release[key] !== built[key]) {
      throw new ConfigurationError(
        "build identity",
        `${key} mismatch; rebuild required`,
      );
    }
  }
}
