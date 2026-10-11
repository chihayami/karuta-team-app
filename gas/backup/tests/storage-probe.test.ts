import { describe, expect, it, vi } from "vitest";
import { createProbeRuntime, createProbeUtilities } from "./probe-runtime";

const folderId = "fictional_development_folder";
const fileId = "fictional_new_probe_file";
const folder = {
  id: folderId,
  mimeType: "application/vnd.google-apps.folder",
  trashed: false,
  capabilities: { canAddChildren: true },
};
const createdFile = {
  id: fileId,
  mimeType: "application/vnd.google-apps.spreadsheet",
  trashed: false,
  parents: [folderId],
  appProperties: {
    purpose: "development-storage-probe",
    environment: "development",
    formatVersion: "1",
  },
};

function createStorageRuntime(
  properties: Readonly<Record<string, unknown>> = {
    APP_ENVIRONMENT: "development",
    BACKUP_FOLDER_ID: folderId,
  },
  overrides: Readonly<Record<string, unknown>> = {},
) {
  let pending: unknown[][] = [];
  let persisted: unknown[][] = [];
  const log = vi.fn();
  const getProperty = vi.fn((name: string): unknown => properties[name]);
  const getScriptProperties = vi.fn(() => ({ getProperty }));
  const get = vi.fn((id: string): unknown =>
    id === folderId ? folder : createdFile,
  );
  const create = vi
    .fn<(metadata: unknown) => unknown>()
    .mockReturnValue({ id: fileId });
  const forbidden = {
    update: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    copy: vi.fn(),
    emptyTrash: vi.fn(),
  };
  const share = vi.fn();
  const setValues = vi.fn((cells: unknown[][]) => {
    pending = structuredClone(cells);
  });
  const setNumberFormat = vi.fn();
  const writeRange = { setValues, setNumberFormat };
  setNumberFormat.mockReturnValue(writeRange);
  const getRange = vi
    .fn<
      (
        row: number,
        column: number,
        rows: number,
        columns: number,
      ) => typeof writeRange
    >()
    .mockReturnValue(writeRange);
  const getValues = vi.fn((): unknown => structuredClone(persisted));
  const getNumRows = vi.fn(() => persisted.length);
  const getNumColumns = vi.fn(() => persisted[0]?.length ?? 0);
  const getDataRange = vi.fn(() => ({ getValues, getNumRows, getNumColumns }));
  const getSheets = vi.fn(() => [{ getRange, getDataRange }]);
  const openById = vi
    .fn<(id: string) => { getSheets: typeof getSheets }>()
    .mockReturnValue({ getSheets });
  const flush = vi.fn(() => {
    persisted = structuredClone(pending);
  });
  const runtime = createProbeRuntime(
    ["config.js", "probe-format.js", "storage-probe.js"],
    {
      PropertiesService: { getScriptProperties },
      Drive: {
        Files: { get, create, ...forbidden },
        Permissions: { create: share },
      },
      SpreadsheetApp: { openById, flush },
      console: { log },
      ...overrides,
    },
  );
  return {
    ...runtime,
    log,
    getProperty,
    getScriptProperties,
    get,
    create,
    forbidden,
    share,
    setValues,
    setNumberFormat,
    getRange,
    getValues,
    getNumRows,
    getNumColumns,
    getSheets,
    openById,
    flush,
    persisted: () => structuredClone(persisted),
    run: () => runtime.evaluate("runDevelopmentStorageProbe()"),
  };
}

function expectFailure(
  runtime: ReturnType<typeof createStorageRuntime>,
  message: string,
) {
  let failure: unknown;
  try {
    runtime.run();
  } catch (error) {
    failure = error;
  }
  // Exact messages ensure service errors or stored values are not appended.
  expect(String(failure)).toBe(`Error: ${message}`);
  expect(runtime.log).not.toHaveBeenCalled();
  expect(runtime.share).not.toHaveBeenCalled();
  for (const method of Object.values(runtime.forbidden))
    expect(method).not.toHaveBeenCalled();
}

describe("development storage probe", () => {
  it("writes only to the newly created file, flushes, and verifies persisted contents", () => {
    const runtime = createStorageRuntime();
    const result = runtime.run();
    expect(result).toEqual({
      status: "verified",
      environment: "development",
      recordCount: 3,
    });
    expect(runtime.create).toHaveBeenCalledExactlyOnceWith({
      name: "development-storage-probe-fictional-probe-uuid",
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
      appProperties: createdFile.appProperties,
    });
    expect(runtime.get.mock.calls.map(([id]) => id)).toEqual([
      folderId,
      fileId,
    ]);
    expect(runtime.getProperty.mock.calls).toEqual([
      ["APP_ENVIRONMENT"],
      ["BACKUP_FOLDER_ID"],
    ]);
    expect(runtime.openById.mock.calls).toEqual([[fileId], [fileId]]);
    expect(runtime.setNumberFormat).toHaveBeenCalledExactlyOnceWith("@");
    expect(runtime.getRange).toHaveBeenCalledExactlyOnceWith(
      1,
      1,
      runtime.persisted().length,
      2,
    );
    expect(runtime.flush).toHaveBeenCalledOnce();
    expect(runtime.getValues).toHaveBeenCalledOnce();
    expect(runtime.log).toHaveBeenCalledExactlyOnceWith(JSON.stringify(result));
    expect(JSON.stringify(runtime.log.mock.calls)).not.toContain(folderId);
    expect(JSON.stringify(runtime.log.mock.calls)).not.toContain(fileId);
    expect(JSON.stringify(runtime.log.mock.calls)).not.toContain("memberCode");
    expect(runtime.share).not.toHaveBeenCalled();
    for (const method of Object.values(runtime.forbidden))
      expect(method).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied data or file IDs before accessing services", () => {
    const runtime = createStorageRuntime();
    expect(() =>
      runtime.evaluate("runDevelopmentStorageProbe(input)", {
        id: "existing_file",
      }),
    ).toThrow("Development storage probe does not accept arguments");
    expect(runtime.getScriptProperties).not.toHaveBeenCalled();
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it.each(["production", undefined, "development "])(
    "rejects environment %j before accessing Drive",
    (environment) => {
      const runtime = createStorageRuntime({
        APP_ENVIRONMENT: environment,
        BACKUP_FOLDER_ID: folderId,
      });
      expectFailure(runtime, "APP_ENVIRONMENT must be development");
      expect(runtime.get).not.toHaveBeenCalled();
      expect(runtime.create).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing folder setting before accessing Drive", () => {
    const runtime = createStorageRuntime({ APP_ENVIRONMENT: "development" });
    expectFailure(
      runtime,
      "BACKUP_FOLDER_ID must be a non-empty ID without whitespace",
    );
    expect(runtime.get).not.toHaveBeenCalled();
  });

  it("sanitizes property access failure", () => {
    const runtime = createStorageRuntime();
    runtime.getScriptProperties.mockImplementation(() => {
      throw new Error("service-secret-canary");
    });
    expectFailure(runtime, "Unable to access GAS script properties");
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...folder, id: "other_folder" },
    { ...folder, mimeType: "application/vnd.google-apps.spreadsheet" },
    { ...folder, trashed: true },
    { ...folder, capabilities: { canAddChildren: false } },
    { ...folder, capabilities: undefined },
  ])(
    "rejects invalid or unwritable folder metadata before creation (%j)",
    (metadata) => {
      const runtime = createStorageRuntime();
      runtime.get.mockReturnValueOnce(metadata);
      expectFailure(
        runtime,
        "Unable to access writable development backup folder",
      );
      expect(runtime.create).not.toHaveBeenCalled();
      expect(runtime.openById).not.toHaveBeenCalled();
    },
  );

  it("sanitizes folder service errors", () => {
    const runtime = createStorageRuntime();
    runtime.get.mockImplementation(() => {
      throw new Error("service-secret-canary");
    });
    expectFailure(
      runtime,
      "Unable to access writable development backup folder",
    );
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it("rejects an unavailable Drive advanced service", () => {
    expectFailure(
      createStorageRuntime(undefined, { Drive: undefined }),
      "Unable to access writable development backup folder",
    );
  });

  it("sanitizes creation errors without attempting any write", () => {
    const runtime = createStorageRuntime();
    runtime.create.mockImplementation(() => {
      throw new Error("service-secret-canary");
    });
    expectFailure(runtime, "Unable to create development probe file");
    expect(runtime.openById).not.toHaveBeenCalled();
  });

  it.each([null, {}, { id: "" }, { id: " file " }, { id: 123 }])(
    "rejects malformed create responses before opening a file (%j)",
    (metadata) => {
      const runtime = createStorageRuntime();
      runtime.create.mockReturnValueOnce(metadata);
      expectFailure(runtime, "Unable to create development probe file");
      expect(runtime.openById).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    { ...createdFile, id: "existing_file" },
    { ...createdFile, mimeType: "application/vnd.google-apps.folder" },
    { ...createdFile, parents: ["other_folder"] },
    { ...createdFile, parents: [folderId, "other_folder"] },
    { ...createdFile, trashed: true },
    {
      ...createdFile,
      appProperties: {
        ...createdFile.appProperties,
        environment: "production",
      },
    },
    {
      ...createdFile,
      appProperties: { ...createdFile.appProperties, purpose: "other" },
    },
    {
      ...createdFile,
      appProperties: { ...createdFile.appProperties, formatVersion: "2" },
    },
  ])(
    "rejects unexpected new file metadata before any write (%j)",
    (metadata) => {
      const runtime = createStorageRuntime();
      runtime.get.mockReturnValueOnce(folder).mockReturnValueOnce(metadata);
      expectFailure(runtime, "Unable to create development probe file");
      expect(runtime.openById).not.toHaveBeenCalled();
    },
  );

  it.each(["open", "format", "write", "flush"])(
    "sanitizes %s errors and suppresses successful readback",
    (stage) => {
      const runtime = createStorageRuntime();
      const failure = () => {
        throw new Error("service-secret-canary");
      };
      if (stage === "open") runtime.openById.mockImplementation(failure);
      if (stage === "format")
        runtime.setNumberFormat.mockImplementation(failure);
      if (stage === "write") runtime.setValues.mockImplementation(failure);
      if (stage === "flush") runtime.flush.mockImplementation(failure);
      expectFailure(runtime, "Unable to write development probe file");
      expect(runtime.getValues).not.toHaveBeenCalled();
    },
  );

  it("rejects a file with no sheet", () => {
    const runtime = createStorageRuntime();
    runtime.getSheets.mockReturnValueOnce([]);
    expectFailure(runtime, "Unable to write development probe file");
    expect(runtime.setValues).not.toHaveBeenCalled();
  });

  it("sanitizes readback errors", () => {
    const runtime = createStorageRuntime();
    runtime.getValues.mockImplementation(() => {
      throw new Error("service-secret-canary");
    });
    expectFailure(runtime, "Unable to read development probe file");
  });

  it.each([0, 5, 49, 10000])(
    "rejects unexpected readback row count %j before downloading values",
    (count) => {
      const runtime = createStorageRuntime();
      runtime.getNumRows.mockReturnValue(count);
      expectFailure(runtime, "Unable to read development probe file");
      expect(runtime.getValues).not.toHaveBeenCalled();
    },
  );

  it("rejects unexpected readback column count before downloading values", () => {
    const runtime = createStorageRuntime();
    runtime.getNumColumns.mockReturnValue(3);
    expectFailure(runtime, "Unable to read development probe file");
    expect(runtime.getValues).not.toHaveBeenCalled();
  });

  it("rejects stored corruption instead of comparing the writer's input", () => {
    const runtime = createStorageRuntime();
    runtime.getValues.mockImplementation(() => {
      const cells = runtime.persisted();
      cells[3] = ["sha256", `sha256:${"0".repeat(64)}`];
      return cells;
    });
    expectFailure(runtime, "Invalid development probe data");
  });

  it("rejects different records even with a valid checksum", () => {
    const runtime = createStorageRuntime();
    const changedCells = runtime.evaluate(`
      const changed = createProbeFixture_();
      changed[0].optionalValue = "";
      encodeProbeRecords_(changed);
    `);
    runtime.getValues.mockReturnValue(changedCells);
    expectFailure(runtime, "Development storage probe verification failed");
  });

  it("creates fresh files on each invocation and never reuses a caller-selected file", () => {
    const utilities = createProbeUtilities();
    const getUuid = vi
      .fn()
      .mockReturnValueOnce("first-fictional-uuid")
      .mockReturnValueOnce("second-fictional-uuid");
    const runtime = createStorageRuntime(undefined, {
      Utilities: { ...utilities, getUuid },
    });
    runtime.create
      .mockReturnValueOnce({ id: "first_new_file" })
      .mockReturnValueOnce({ id: "second_new_file" });
    runtime.get
      .mockReturnValueOnce(folder)
      .mockReturnValueOnce({ ...createdFile, id: "first_new_file" })
      .mockReturnValueOnce(folder)
      .mockReturnValueOnce({ ...createdFile, id: "second_new_file" });
    runtime.run();
    runtime.run();
    expect(runtime.create).toHaveBeenCalledTimes(2);
    expect(runtime.create.mock.calls).toMatchObject([
      [{ name: "development-storage-probe-first-fictional-uuid" }],
      [{ name: "development-storage-probe-second-fictional-uuid" }],
    ]);
    expect(runtime.openById.mock.calls).toEqual([
      ["first_new_file"],
      ["first_new_file"],
      ["second_new_file"],
      ["second_new_file"],
    ]);
  });
});
