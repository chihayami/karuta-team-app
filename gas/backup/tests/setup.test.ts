import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = ["config.js", "healthcheck.js"]
  .map((file) =>
    readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"),
  )
  .join("\n");

function createRuntime(
  values: Readonly<Record<string, unknown>>,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const log = vi.fn();
  const getProperty = vi.fn((name: string): unknown => values[name]);
  const getProperties = vi.fn(() => {
    throw new Error("Bulk property access is forbidden in this check");
  });
  const context = createContext({
    PropertiesService: {
      getScriptProperties: () => ({ getProperty, getProperties }),
    },
    console: { log },
    ...overrides,
  });
  runInContext(source, context, { timeout: 1000 });

  return {
    log,
    getProperty,
    getProperties,
    run(): unknown {
      return runInContext("checkDevelopmentSetup()", context, {
        timeout: 1000,
      });
    },
  };
}

const development = {
  APP_ENVIRONMENT: "development",
  BACKUP_FOLDER_ID: "fictional_folder_123",
};

describe("GAS development setup", () => {
  it("returns and logs only the configuration status", () => {
    const runtime = createRuntime({
      ...development,
      SECRET_CANARY: "never-log-this-value",
    });
    const result = runtime.run();
    expect(result).toEqual({
      status: "configured",
      environment: "development",
      backupFolderConfigured: true,
    });
    expect(runtime.log).toHaveBeenCalledExactlyOnceWith(JSON.stringify(result));
    expect(runtime.getProperty.mock.calls).toEqual([
      ["APP_ENVIRONMENT"],
      ["BACKUP_FOLDER_ID"],
    ]);
    expect(runtime.getProperties).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(development.BACKUP_FOLDER_ID);
    expect(JSON.stringify(runtime.log.mock.calls)).not.toContain(
      "never-log-this-value",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "production",
    "staging",
    " development",
    "development ",
    "Development",
    123,
    false,
    {},
  ])(
    "rejects unsupported APP_ENVIRONMENT (%j) before reading the folder",
    (value) => {
      const runtime = createRuntime({ ...development, APP_ENVIRONMENT: value });
      expect(runtime.run).toThrow("APP_ENVIRONMENT must be development");
      expect(runtime.log).not.toHaveBeenCalled();
      expect(runtime.getProperty.mock.calls).toEqual([["APP_ENVIRONMENT"]]);
    },
  );

  it.each([
    null,
    undefined,
    "",
    " ",
    " folder",
    "folder ",
    "folder\tname",
    "folder\nname",
    "folder\u3000name",
    0,
    false,
    {},
    [],
  ])("rejects malformed BACKUP_FOLDER_ID (%j)", (value) => {
    const runtime = createRuntime({ ...development, BACKUP_FOLDER_ID: value });
    expect(runtime.run).toThrow(
      "BACKUP_FOLDER_ID must be a non-empty ID without whitespace",
    );
    expect(runtime.log).not.toHaveBeenCalled();
  });

  it.each(["APP_ENVIRONMENT", "BACKUP_FOLDER_ID"] as const)(
    "does not echo invalid %s values",
    (name) => {
      const runtime = createRuntime({
        ...development,
        [name]: " secret-canary ",
      });
      let failure: unknown;
      try {
        runtime.run();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeDefined();
      expect(String(failure)).toContain(name);
      expect(String(failure)).not.toContain("secret-canary");
      expect(runtime.log).not.toHaveBeenCalled();
    },
  );

  it("sanitizes a failure to obtain the property store", () => {
    const runtime = createRuntime(development, {
      PropertiesService: {
        getScriptProperties: () => {
          throw new Error("service-secret-canary");
        },
      },
    });
    expect(runtime.run).toThrow("Unable to access GAS script properties");
    expect(runtime.run).not.toThrow("service-secret-canary");
    expect(runtime.log).not.toHaveBeenCalled();
  });

  it("sanitizes a property service read failure", () => {
    const runtime = createRuntime(development, {
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: () => {
            throw new Error("service-secret-canary");
          },
        }),
      },
    });
    expect(runtime.run).toThrow(
      "Unable to read GAS script property: APP_ENVIRONMENT",
    );
    expect(runtime.run).not.toThrow("service-secret-canary");
    expect(runtime.log).not.toHaveBeenCalled();
  });
});
