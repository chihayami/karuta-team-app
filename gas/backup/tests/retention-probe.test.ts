import { describe, expect, it } from "vitest";
import {
  createRetentionRuntime,
  retentionFolderId,
  retentionRunId,
  retentionToken,
} from "./retention-probe-runtime";

type Runtime = ReturnType<typeof createRetentionRuntime>;

function expectFailure(runtime: Runtime, message: string) {
  let failure: unknown;
  try {
    runtime.run();
  } catch (error) {
    failure = error;
  }
  expect(String(failure)).toBe(`Error: ${message}`);
  expect(runtime.log).not.toHaveBeenCalled();
  expect(runtime.getContentText).not.toHaveBeenCalled();
  for (const fn of Object.values(runtime.forbidden))
    expect(fn).not.toHaveBeenCalled();
}

function withMetadataChange(runtime: Runtime, change: (id: string) => void) {
  const get = runtime.get.getMockImplementation();
  if (!get) throw new Error("Missing mock implementation");
  runtime.get.mockImplementation((id: string) => {
    if (id !== retentionFolderId) change(id);
    return get(id);
  });
}

describe("development generation retention probe", () => {
  it("retains values and original deadlines, permanently deletes exactly two new files, and leaves existing files alone", () => {
    const runtime = createRetentionRuntime();
    const result = runtime.run();
    expect(result).toEqual({
      status: "verified",
      environment: "development",
      sourceRecordCount: 3,
      retainedRecordCount: 2,
      expiredRecordCount: 1,
      permanentlyDeletedFileCount: 2,
    });
    expect(runtime.create).toHaveBeenCalledTimes(3);
    expect(runtime.remove.mock.calls).toEqual([
      ["fictional_probe_file_1"],
      ["fictional_probe_file_3"],
    ]);
    expect(runtime.removed).toEqual(
      new Set(["fictional_probe_file_1", "fictional_probe_file_3"]),
    );
    const original = runtime.metadata.get("fictional_probe_file_1");
    const replacement = runtime.metadata.get("fictional_probe_file_2");
    expect(original?.appProperties.probeKind).toBe("original");
    expect(replacement?.appProperties).toEqual({
      ...original?.appProperties,
      probeKind: "replacement",
    });
    expect(replacement?.appProperties.snapshotCreatedAt).toBe(
      "2026-02-27T15:00:00.000Z",
    );
    expect(replacement?.appProperties.generationExpiresAt).toBe(
      "2026-03-14T15:00:00.000Z",
    );
    const retained = runtime.evaluate(
      "decodeProbeRecords_(input)",
      runtime.persisted.get("fictional_probe_file_2"),
    );
    expect(retained).toMatchObject([
      {
        memberCode: "0012",
        optionalValue: "",
        amount: 12.5,
        probeExpiresAt: "2026-02-28T15:00:00.001Z",
      },
      {
        memberCode: "0000",
        optionalValue: "null",
        probeExpiresAt: null,
        metadata: { label: "日本語と𠮷" },
      },
    ]);
    expect(runtime.log).toHaveBeenCalledExactlyOnceWith(JSON.stringify(result));
    const log = JSON.stringify(runtime.log.mock.calls);
    for (const canary of [
      retentionToken,
      retentionRunId,
      retentionFolderId,
      "fictional_probe_file",
      "memberCode",
    ]) {
      expect(log).not.toContain(canary);
    }
    expect(runtime.fetch).toHaveBeenCalledTimes(4);
    for (const [url, options] of runtime.fetch.mock.calls) {
      expect(url).toMatch(
        /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/fictional_probe_file_[13]\?fields=id$/,
      );
      expect(options).toEqual({
        method: "get",
        headers: { Authorization: `Bearer ${retentionToken}` },
        followRedirects: false,
        muteHttpExceptions: true,
        validateHttpsCertificates: true,
        timeoutSeconds: 30,
      });
    }
    expect(runtime.getProperty.mock.calls).toEqual([
      ["APP_ENVIRONMENT"],
      ["BACKUP_FOLDER_ID"],
    ]);
    for (const [id] of runtime.openById.mock.calls)
      expect(runtime.metadata.has(id)).toBe(true);
    expect(runtime.getContentText).not.toHaveBeenCalled();
    for (const fn of Object.values(runtime.forbidden))
      expect(fn).not.toHaveBeenCalled();
  });

  it("does not accept caller-selected IDs", () => {
    const runtime = createRetentionRuntime();
    expect(() =>
      runtime.evaluate("runDevelopmentRetentionProbe(input)", "existing_file"),
    ).toThrow("Development retention probe does not accept arguments");
    expect(runtime.getScriptProperties).not.toHaveBeenCalled();
  });

  it.each(["production", undefined, "development "])(
    "rejects environment %j before Drive access",
    (environment) => {
      const runtime = createRetentionRuntime({
        APP_ENVIRONMENT: environment,
        BACKUP_FOLDER_ID: retentionFolderId,
      });
      expectFailure(runtime, "APP_ENVIRONMENT must be development");
      expect(runtime.get).not.toHaveBeenCalled();
      expect(runtime.remove).not.toHaveBeenCalled();
    },
  );

  it("sanitizes property service failures", () => {
    const runtime = createRetentionRuntime();
    runtime.getScriptProperties.mockImplementation(() => {
      throw new Error("service-secret-canary");
    });
    expectFailure(runtime, "Unable to access GAS script properties");
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it.each(["not-folder", "trashed", "cannot-add"])(
    "refuses folder state %s before creation",
    (state) => {
      const runtime = createRetentionRuntime();
      if (state === "not-folder")
        runtime.folder.mimeType = "application/vnd.google-apps.spreadsheet";
      if (state === "trashed") runtime.folder.trashed = true;
      if (state === "cannot-add")
        runtime.folder.capabilities.canAddChildren = false;
      expectFailure(
        runtime,
        "Unable to access writable development backup folder",
      );
      expect(runtime.create).not.toHaveBeenCalled();
      expect(runtime.remove).not.toHaveBeenCalled();
    },
  );

  it("sanitizes Drive access failures", () => {
    const runtime = createRetentionRuntime();
    runtime.get.mockImplementation(() => {
      throw new Error("service-secret-canary");
    });
    expectFailure(
      runtime,
      "Unable to access writable development backup folder",
    );
    expect(runtime.remove).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { id: retentionFolderId },
    { id: "https://example.invalid" },
    { id: "other?file" },
    { id: "file/other" },
    { id: " file " },
    { id: "x".repeat(201) },
  ])(
    "refuses malformed create responses before opening or deleting files (%j)",
    (response) => {
      const runtime = createRetentionRuntime();
      runtime.create.mockReturnValueOnce(response);
      expectFailure(
        runtime,
        "Unable to create development retention probe file",
      );
      expect(runtime.openById).not.toHaveBeenCalled();
      expect(runtime.remove).not.toHaveBeenCalled();
    },
  );

  it("refuses a repeated create response ID instead of overwriting or deleting the source", () => {
    const runtime = createRetentionRuntime();
    const create = runtime.create.getMockImplementation();
    if (!create) throw new Error("Missing mock implementation");
    runtime.create
      .mockImplementationOnce(create)
      .mockReturnValueOnce({ id: "fictional_probe_file_1" });
    expectFailure(runtime, "Unable to create development retention probe file");
    expect(runtime.remove).not.toHaveBeenCalled();
    expect(runtime.setValues).toHaveBeenCalledTimes(1);
  });

  it.each([
    "id",
    "folder",
    "mimeType",
    "trashed",
    "owner",
    "purpose",
    "environment",
    "run",
    "kind",
    "created",
    "expiry",
  ])("refuses changed %s metadata immediately before deletion", (field) => {
    const runtime = createRetentionRuntime();
    withMetadataChange(runtime, (id) => {
      if (
        id !== "fictional_probe_file_1" ||
        !runtime.metadata.has("fictional_probe_file_2")
      )
        return;
      const metadata = runtime.metadata.get(id);
      if (!metadata) throw new Error("Missing test file");
      if (field === "id") metadata.id = "existing_file";
      if (field === "folder") metadata.parents = ["other_folder"];
      if (field === "mimeType")
        metadata.mimeType = "application/vnd.google-apps.folder";
      if (field === "trashed") metadata.trashed = true;
      if (field === "owner") metadata.ownedByMe = false;
      const key = {
        purpose: "purpose",
        environment: "environment",
        run: "probeRunId",
        kind: "probeKind",
        created: "snapshotCreatedAt",
        expiry: "generationExpiresAt",
      }[field];
      if (key) metadata.appProperties[key] = "changed-secret-canary";
    });
    expectFailure(
      runtime,
      "Unable to verify development retention probe file metadata",
    );
    expect(runtime.remove).not.toHaveBeenCalled();
  });

  it("refuses deletion when canDelete is false", () => {
    const runtime = createRetentionRuntime();
    withMetadataChange(runtime, (id) => {
      const metadata = runtime.metadata.get(id);
      if (metadata) metadata.capabilities.canDelete = false;
    });
    expectFailure(
      runtime,
      "Unable to verify development retention probe file metadata",
    );
    expect(runtime.remove).not.toHaveBeenCalled();
  });

  it("rechecks metadata after the HTTP read before deleting", () => {
    const runtime = createRetentionRuntime();
    const fetch = runtime.fetch.getMockImplementation();
    if (!fetch) throw new Error("Missing mock implementation");
    runtime.fetch.mockImplementation((url, options) => {
      const result = fetch(url, options);
      const metadata = runtime.metadata.get("fictional_probe_file_1");
      if (metadata) metadata.appProperties.probeRunId = "other-run";
      return result;
    });
    expectFailure(
      runtime,
      "Unable to verify development retention probe file metadata",
    );
    expect(runtime.remove).not.toHaveBeenCalled();
  });

  it.each(["write", "flush", "read", "corrupt", "changed-record"])(
    "keeps the original when replacement %s fails",
    (stage) => {
      const runtime = createRetentionRuntime();
      if (stage === "write") {
        const write = runtime.setValues.getMockImplementation();
        if (!write) throw new Error("Missing mock implementation");
        runtime.setValues.mockImplementation((id, cells) => {
          if (id === "fictional_probe_file_2")
            throw new Error("service-secret-canary");
          write(id, cells);
        });
      }
      if (stage === "flush") {
        const flush = runtime.flush.getMockImplementation();
        if (!flush) throw new Error("Missing mock implementation");
        runtime.flush.mockImplementation(() => {
          if (runtime.metadata.has("fictional_probe_file_2"))
            throw new Error("service-secret-canary");
          flush();
        });
      }
      if (
        stage === "read" ||
        stage === "corrupt" ||
        stage === "changed-record"
      ) {
        const read = runtime.getValues.getMockImplementation();
        if (!read) throw new Error("Missing mock implementation");
        runtime.getValues.mockImplementation((id) => {
          if (id !== "fictional_probe_file_2") return read(id);
          if (stage === "read") throw new Error("service-secret-canary");
          if (stage === "changed-record") {
            return runtime.evaluate(
              `(() => {
            const records = decodeProbeRecords_(input);
            records[0].optionalValue = null;
            return encodeProbeRecords_(records);
          })()`,
              read(id),
            );
          }
          return [["corrupt", "secret-canary"]];
        });
      }
      expectFailure(
        runtime,
        stage === "write" || stage === "flush"
          ? "Unable to write development retention probe file"
          : "Unable to verify development retention probe file contents",
      );
      expect(runtime.remove).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403, 404, 500, 302])(
    "does not delete when the pre-delete HTTP status is %j",
    (status) => {
      const runtime = createRetentionRuntime();
      runtime.fetch.mockReturnValueOnce({
        getResponseCode: () => status,
        getContentText: runtime.getContentText,
      });
      expectFailure(
        runtime,
        "Development retention probe file is not readable before deletion",
      );
      expect(runtime.remove).not.toHaveBeenCalled();
    },
  );

  it.each([200, 401, 403, 500, 302])(
    "does not report deletion success for post-delete HTTP status %j",
    (status) => {
      const runtime = createRetentionRuntime();
      runtime.fetch
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: runtime.getContentText,
        })
        .mockReturnValueOnce({
          getResponseCode: () => status,
          getContentText: runtime.getContentText,
        });
      expectFailure(
        runtime,
        "Development retention probe permanent deletion was not confirmed",
      );
      expect(runtime.remove).toHaveBeenCalledExactlyOnceWith(
        "fictional_probe_file_1",
      );
      expect(runtime.create).toHaveBeenCalledTimes(2);
    },
  );

  it("does not convert a delete exception into success or retry it", () => {
    const runtime = createRetentionRuntime();
    runtime.remove.mockImplementation(() => {
      throw new Error("service-secret-canary");
    });
    expectFailure(
      runtime,
      "Unable to permanently delete development retention probe file",
    );
    expect(runtime.remove).toHaveBeenCalledOnce();
    expect(runtime.fetch).toHaveBeenCalledOnce();
  });

  it.each(["before", "after"])(
    "sanitizes %s-delete request exceptions",
    (stage) => {
      const runtime = createRetentionRuntime();
      const failure = () => {
        throw new Error("service-secret-canary");
      };
      if (stage === "before") runtime.fetch.mockImplementation(failure);
      else
        runtime.fetch
          .mockReturnValueOnce({
            getResponseCode: () => 200,
            getContentText: runtime.getContentText,
          })
          .mockImplementationOnce(failure);
      expectFailure(
        runtime,
        "Unable to check development retention probe file status",
      );
      expect(runtime.remove).toHaveBeenCalledTimes(stage === "before" ? 0 : 1);
    },
  );

  it.each(["", "token\r\nheader", undefined])(
    "refuses malformed tokens without making requests",
    (token) => {
      const runtime = createRetentionRuntime();
      runtime.getOAuthToken.mockReturnValue(token);
      expectFailure(
        runtime,
        "Unable to check development retention probe file status",
      );
      expect(runtime.fetch).not.toHaveBeenCalled();
      expect(runtime.remove).not.toHaveBeenCalled();
    },
  );

  it("does not report success if the retained file changes after deletion", () => {
    const runtime = createRetentionRuntime();
    const read = runtime.getValues.getMockImplementation();
    if (!read) throw new Error("Missing mock implementation");
    runtime.getValues.mockImplementation((id) => {
      if (id === "fictional_probe_file_2" && runtime.removed.size > 0)
        return [["corrupt", "secret-canary"]];
      return read(id);
    });
    expectFailure(
      runtime,
      "Unable to verify development retention probe file contents",
    );
    expect(runtime.remove).toHaveBeenCalledExactlyOnceWith(
      "fictional_probe_file_1",
    );
  });

  it("does not report partial success when the expired generation cannot be deleted", () => {
    const runtime = createRetentionRuntime();
    const remove = runtime.remove.getMockImplementation();
    if (!remove) throw new Error("Missing mock implementation");
    runtime.remove.mockImplementation((id) => {
      if (id === "fictional_probe_file_3")
        throw new Error("service-secret-canary");
      remove(id);
    });
    expectFailure(
      runtime,
      "Unable to permanently delete development retention probe file",
    );
    expect(runtime.removed).toEqual(new Set(["fictional_probe_file_1"]));
  });

  it.each([5, 49, 10000])(
    "rejects an unbounded replacement range with %j rows before fetching values",
    (rows) => {
      const runtime = createRetentionRuntime();
      const getRows = runtime.getNumRows.getMockImplementation();
      if (!getRows) throw new Error("Missing mock implementation");
      runtime.getNumRows.mockImplementation((id) =>
        id === "fictional_probe_file_2" ? rows : getRows(id),
      );
      expectFailure(
        runtime,
        "Unable to verify development retention probe file contents",
      );
      expect(runtime.remove).not.toHaveBeenCalled();
      expect(runtime.getValues.mock.calls).not.toContainEqual([
        "fictional_probe_file_2",
      ]);
    },
  );
});
