import { describe, expect, it } from "vitest";
import {
  assertBuildIdentity,
  ConfigurationError,
  readAppConfiguration,
} from "../../web/src/platform/environment";
import { environmentFixture, TEST_BINDINGS } from "./environment-fixtures";

describe("TST-ENV-02 / TST-SYS-15: configuration boundary", () => {
  it.each(Object.keys(environmentFixture()))("rejects missing %s", (field) => {
    const input = environmentFixture();
    delete input[field];
    expect(() => readAppConfiguration(input, "0.1.0")).toThrow(
      ConfigurationError,
    );
  });

  it.each([
    ["APP_ENVIRONMENT", "staging"],
    ["APP_ENVIRONMENT", " development"],
    ["APP_DEPLOYMENT_TARGET", "unknown"],
    ["APP_DEPLOYMENT_TARGET", "production"],
    ["APP_GIT_SHA", "abcdef1"],
    ["APP_GIT_SHA", "g".repeat(40)],
    ["APP_GIT_SHA", "0".repeat(40)],
    ["APP_CONFIG_REVISION", ""],
    ["APP_CONFIG_REVISION", "a\nb"],
    ["APP_ENVIRONMENT_BINDINGS", "not-json"],
    ["APP_ENVIRONMENT_BINDINGS", "null"],
    ["APP_ENVIRONMENT_BINDINGS", "[]"],
    ["APP_ENVIRONMENT_BINDINGS", "{}"],
  ])("rejects invalid %s (%s)", (field, value) => {
    expect(() =>
      readAppConfiguration(
        { ...environmentFixture(), [field]: value },
        "0.1.0",
      ),
    ).toThrow(ConfigurationError);
  });

  it.each([null, false, 123, {}, []])(
    "rejects non-string external values (%j)",
    (value) => {
      expect(() =>
        readAppConfiguration(
          { ...environmentFixture(), APP_ORIGIN: value },
          "0.1.0",
        ),
      ).toThrow(ConfigurationError);
    },
  );

  it.each([
    "http://development.members.example.org",
    "https://user:password@development.members.example.org",
    "https://development.members.example.org/private",
    "https://development.members.example.org?token=example",
    "https://development.members.example.org#fragment",
    "javascript:alert(1)",
    "http://localhost:3000",
    "https://development.members.example.org/",
  ])("rejects unsafe or non-canonical published origin (%s)", (value) => {
    expect(() =>
      readAppConfiguration(
        { ...environmentFixture(), APP_ORIGIN: value },
        "0.1.0",
      ),
    ).toThrow(ConfigurationError);
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])(
    "permits local loopback (%s) with explicit development configuration",
    (value) => {
      const input = {
        ...environmentFixture("development", "local"),
        APP_ORIGIN: value,
      };
      expect(readAppConfiguration(input, "0.1.0").origin).toBe(value);
    },
  );

  it("rejects remote origins and production configuration for local target", () => {
    expect(() =>
      readAppConfiguration(
        {
          ...environmentFixture("development", "local"),
          APP_ORIGIN: TEST_BINDINGS.development.origin,
        },
        "0.1.0",
      ),
    ).toThrow(ConfigurationError);
    expect(() =>
      readAppConfiguration(environmentFixture("production", "local"), "0.1.0"),
    ).toThrow(ConfigurationError);
  });

  it.each(Object.keys(TEST_BINDINGS.development))(
    "rejects shared %s between environments",
    (key) => {
      const manifest = structuredClone(TEST_BINDINGS);
      const field = key as keyof typeof manifest.development;
      manifest.production[field] = manifest.development[field];
      expect(() =>
        readAppConfiguration(
          {
            ...environmentFixture(),
            APP_ENVIRONMENT_BINDINGS: JSON.stringify(manifest),
          },
          "0.1.0",
        ),
      ).toThrow(ConfigurationError);
    },
  );

  it.each([
    ["supabaseProjectRef", "invalid-ref"],
    ["lineChannelId", "not-a-channel"],
    ["liffId", "not-a-liff-id"],
    ["gasDeploymentId", "contains space"],
    ["origin", "http://localhost:3000"],
  ])("validates the environment bindings themselves (%s)", (field, value) => {
    const manifest = structuredClone(TEST_BINDINGS);
    manifest.development[field as keyof typeof manifest.development] = value;
    expect(() =>
      readAppConfiguration(
        {
          ...environmentFixture(),
          APP_ENVIRONMENT_BINDINGS: JSON.stringify(manifest),
        },
        "0.1.0",
      ),
    ).toThrow(ConfigurationError);
  });

  it.each([
    { VERCEL: "1" },
    { VERCEL: "0" },
    { VERCEL_ENV: "production" },
    { VERCEL_TARGET_ENV: "staging" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_GIT_COMMIT_REF: "unreviewed/branch" },
    { VERCEL_GIT_COMMIT_SHA: "1".repeat(40) },
  ])("rejects mismatched host metadata (%j)", (host) => {
    expect(() =>
      readAppConfiguration({ ...environmentFixture(), ...host }, "0.1.0"),
    ).toThrow(ConfigurationError);
  });

  it("does not classify the initial Vercel Production deployment as development by branch name", () => {
    const input = {
      ...environmentFixture(),
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "develop",
    };
    expect(() => readAppConfiguration(input, "0.1.0")).toThrow(
      ConfigurationError,
    );
  });

  it.each(["develop", "feature/environment-foundation", "fix/display-version"])(
    "accepts configured Preview on %s",
    (branch) => {
      const input = {
        ...environmentFixture(),
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: branch,
      };
      expect(readAppConfiguration(input, "0.1.0").release.environment).toBe(
        "development",
      );
    },
  );

  it("errors report field names without echoing malformed credentials", () => {
    const value =
      "https://operator:secret-canary@development.members.example.org";
    try {
      readAppConfiguration(
        { ...environmentFixture(), APP_ORIGIN: value },
        "0.1.0",
      );
      expect.fail("invalid configuration was accepted");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).toContain("APP_ORIGIN");
      expect(String(error)).not.toContain("secret-canary");
    }
  });
});

describe("TST-ENV-05: environment-specific service identifiers", () => {
  it.each([
    "APP_ORIGIN",
    "APP_SUPABASE_URL",
    "APP_LINE_CHANNEL_ID",
    "APP_LIFF_ID",
    "APP_GAS_DEPLOYMENT_ID",
  ])("rejects production %s in development and the reverse", (field) => {
    const development = environmentFixture();
    const production = environmentFixture("production", "production");
    expect(() =>
      readAppConfiguration(
        { ...development, [field]: production[field] },
        "0.1.0",
      ),
    ).toThrow(ConfigurationError);
    expect(() =>
      readAppConfiguration(
        { ...production, [field]: development[field] },
        "0.1.0",
      ),
    ).toThrow(ConfigurationError);
  });

  it("accepts production settings on the explicitly configured main/Production target", () => {
    const input = {
      ...environmentFixture("production", "production"),
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
    };
    const configuration = readAppConfiguration(input, "0.1.0");
    expect(configuration.services.supabaseProjectRef).toBe(
      TEST_BINDINGS.production.supabaseProjectRef,
    );
    expect(configuration.release.displayVersion).toBe("0.1.0");
  });

  it("rejects local example origins on a published target", () => {
    const manifest = structuredClone(TEST_BINDINGS);
    manifest.development.origin = "https://development.example.invalid";
    expect(() =>
      readAppConfiguration(
        {
          ...environmentFixture(),
          APP_ORIGIN: manifest.development.origin,
          APP_ENVIRONMENT_BINDINGS: JSON.stringify(manifest),
        },
        "0.1.0",
      ),
    ).toThrow(ConfigurationError);
  });
});

describe("TST-ENV-03: source version and build identity", () => {
  it("derives development display version from the package version and full source SHA", () => {
    const release = readAppConfiguration(environmentFixture(), "0.1.0").release;
    expect(release.displayVersion).toBe("0.1.0-dev.abcdef1");
    expect(release.gitSha).toBe(environmentFixture().APP_GIT_SHA);
    expect(release.sourceVersion).toBe("0.1.0");
  });

  it.each([undefined, "", "01.1.0", "0.1", "0.1.0-dev.1"])(
    "rejects invalid source version (%s)",
    (version) => {
      expect(() => readAppConfiguration(environmentFixture(), version)).toThrow(
        ConfigurationError,
      );
    },
  );

  it.each([
    "environment",
    "gitSha",
    "sourceVersion",
    "configRevision",
  ] as const)("requires a new build when runtime %s differs", (key) => {
    const release = readAppConfiguration(environmentFixture(), "0.1.0").release;
    expect(() =>
      assertBuildIdentity(release, { ...release, [key]: "different-build" }),
    ).toThrow(ConfigurationError);
  });

  it("rejects absent build identity and accepts matching build identity", () => {
    const release = readAppConfiguration(environmentFixture(), "0.1.0").release;
    expect(() =>
      assertBuildIdentity(release, {
        environment: undefined,
        gitSha: undefined,
        sourceVersion: undefined,
        configRevision: undefined,
      }),
    ).toThrow(ConfigurationError);
    expect(() => assertBuildIdentity(release, release)).not.toThrow();
  });
});
