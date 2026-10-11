import { vi } from "vitest";
import { createProbeRuntime, createProbeUtilities } from "./probe-runtime";

export const retentionFolderId = "fictional_development_folder";
export const retentionToken = "fictional-secret-token-canary";
export const retentionRunId = "fictional-retention-run";

type ProbeMetadata = {
  id: string;
  mimeType: string;
  trashed: boolean;
  ownedByMe: boolean;
  parents: string[];
  appProperties: Record<string, string>;
  capabilities: { canDelete: boolean };
};

type ProbeWriteRange = {
  setValues(cells: unknown[][]): void;
  setNumberFormat(format: string): ProbeWriteRange;
};

export function createRetentionRuntime(
  properties: Readonly<Record<string, unknown>> = {
    APP_ENVIRONMENT: "development",
    BACKUP_FOLDER_ID: retentionFolderId,
  },
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const metadata = new Map<string, ProbeMetadata>();
  const persisted = new Map<string, unknown[][]>();
  const pending = new Map<string, unknown[][]>();
  const removed = new Set<string>();
  const folder = {
    id: retentionFolderId,
    mimeType: "application/vnd.google-apps.folder",
    trashed: false,
    capabilities: { canAddChildren: true },
  };
  const log = vi.fn();
  const getProperty = vi.fn((name: string): unknown => properties[name]);
  const getScriptProperties = vi.fn(() => ({ getProperty }));
  const create = vi.fn((resource: unknown): unknown => {
    if (
      !resource ||
      typeof resource !== "object" ||
      !("parents" in resource) ||
      !("appProperties" in resource)
    )
      throw new Error("Malformed test resource");
    const parents = resource.parents;
    const appProperties = resource.appProperties;
    if (
      !Array.isArray(parents) ||
      !parents.every((value) => typeof value === "string") ||
      !appProperties ||
      typeof appProperties !== "object"
    )
      throw new Error("Malformed test metadata");
    const id = `fictional_probe_file_${metadata.size + 1}`;
    const tags: Record<string, string> = {};
    for (const [key, value] of Object.entries(appProperties)) {
      if (typeof value !== "string") throw new Error("Malformed test property");
      tags[key] = value;
    }
    metadata.set(id, {
      id,
      mimeType: "application/vnd.google-apps.spreadsheet",
      trashed: false,
      ownedByMe: true,
      parents: Array.from(parents, (value) => String(value)),
      appProperties: tags,
      capabilities: { canDelete: true },
    });
    return { id };
  });
  const get = vi.fn((id: string): unknown => {
    if (id === retentionFolderId) return structuredClone(folder);
    if (removed.has(id) || !metadata.has(id))
      throw new Error("service-secret-canary");
    return structuredClone(metadata.get(id));
  });
  const remove = vi.fn((id: string) => {
    if (!metadata.has(id) || removed.has(id))
      throw new Error("Refused test delete");
    removed.add(id);
  });
  const forbidden = {
    update: vi.fn(),
    copy: vi.fn(),
    list: vi.fn(),
    emptyTrash: vi.fn(),
    share: vi.fn(),
  };
  const setValues = vi.fn((id: string, cells: unknown[][]) => {
    pending.set(id, structuredClone(cells));
  });
  const getValues = vi.fn((id: string): unknown =>
    structuredClone(persisted.get(id) ?? []),
  );
  const getNumRows = vi.fn((id: string) => persisted.get(id)?.length ?? 0);
  const getNumColumns = vi.fn(
    (id: string) => persisted.get(id)?.[0]?.length ?? 0,
  );
  const getRange =
    vi.fn<
      (
        id: string,
        row: number,
        column: number,
        rows: number,
        columns: number,
      ) => void
    >();
  const openById = vi.fn((id: string) => {
    if (!metadata.has(id) || removed.has(id))
      throw new Error("Refused test open");
    return {
      getSheets: () => [
        {
          getRange(row: number, column: number, rows: number, columns: number) {
            getRange(id, row, column, rows, columns);
            const range: ProbeWriteRange = {
              setValues: (cells: unknown[][]) => setValues(id, cells),
              setNumberFormat: (format: string) => {
                if (format !== "@")
                  throw new Error("Unexpected test number format");
                return range;
              },
            };
            return range;
          },
          getDataRange: () => ({
            getValues: () => getValues(id),
            getNumRows: () => getNumRows(id),
            getNumColumns: () => getNumColumns(id),
          }),
        },
      ],
    };
  });
  const flush = vi.fn(() => {
    for (const [id, cells] of pending)
      persisted.set(id, structuredClone(cells));
    pending.clear();
  });
  const getOAuthToken = vi.fn((): unknown => retentionToken);
  const getContentText = vi.fn(() => {
    throw new Error("Must never read response body");
  });
  const fetch = vi.fn((url: string, options: unknown) => {
    const match =
      /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/(fictional_probe_file_[1-3])\?fields=id$/.exec(
        url,
      );
    const id = match?.[1];
    if (!id || !metadata.has(id)) throw new Error("Unapproved test URL");
    if (!options) throw new Error("Missing test request options");
    return {
      getResponseCode: (): number => (removed.has(id) ? 404 : 200),
      getContentText,
    };
  });
  const runtime = createProbeRuntime(
    [
      "config.js",
      "probe-format.js",
      "probe-retention.js",
      "retention-probe.js",
    ],
    {
      PropertiesService: { getScriptProperties },
      Utilities: { ...createProbeUtilities(), getUuid: () => retentionRunId },
      Drive: {
        Files: { get, create, remove, ...forbidden },
        Permissions: { create: forbidden.share },
      },
      SpreadsheetApp: { openById, flush },
      ScriptApp: { getOAuthToken },
      UrlFetchApp: { fetch },
      console: { log },
      ...overrides,
    },
  );
  return {
    ...runtime,
    metadata,
    persisted,
    removed,
    folder,
    log,
    getProperty,
    getScriptProperties,
    get,
    create,
    remove,
    forbidden,
    setValues,
    getValues,
    getNumRows,
    getNumColumns,
    openById,
    flush,
    getOAuthToken,
    fetch,
    getContentText,
    run: () => runtime.evaluate("runDevelopmentRetentionProbe()"),
  };
}
