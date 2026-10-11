/* exported runDevelopmentRetentionProbe */

/**
 * @typedef {{id: string, kind: 'original'|'replacement'|'expired', snapshotCreatedAt: string, generationExpiresAt: string}} RetentionProbeFile
 */

/**
 * Create fictional files, renew a generation, and delete only this run's old files.
 * @returns {{status: 'verified', environment: 'development', sourceRecordCount: number, retainedRecordCount: number, expiredRecordCount: number, permanentlyDeletedFileCount: number}}
 */
function runDevelopmentRetentionProbe() {
  if (arguments.length !== 0)
    throw new Error("Development retention probe does not accept arguments");
  let properties;
  try {
    properties = PropertiesService.getScriptProperties();
  } catch {
    throw new Error("Unable to access GAS script properties");
  }
  const configuration = readBackupConfiguration_(properties);
  try {
    if (typeof Drive === "undefined" || !Drive.Files) throw new Error();
    const folder = Drive.Files.get(configuration.backupFolderId, {
      fields: "id,mimeType,trashed,capabilities(canAddChildren)",
    });
    if (
      folder.id !== configuration.backupFolderId ||
      folder.mimeType !== "application/vnd.google-apps.folder" ||
      folder.trashed !== false ||
      folder.capabilities?.canAddChildren !== true
    )
      throw new Error();
  } catch {
    throw new Error("Unable to access writable development backup folder");
  }
  /** @type {string} */
  let runId;
  try {
    runId = Utilities.getUuid();
    if (typeof runId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(runId))
      throw new Error();
  } catch {
    throw new Error("Unable to identify development retention probe run");
  }

  // Keep IDs private to this invocation. No folder listing, saved ID, or caller input.
  /** @type {Set<string>} */
  const createdIds = new Set();
  const evaluatedAt = "2026-02-28T15:00:00.000Z"; // March 1, 00:00 JST, simulated.
  /** @type {RetentionProbeRecord[]} */
  const records = createProbeFixture_().map((record, index) => ({
    ...record,
    probeExpiresAt:
      index === 0
        ? evaluatedAt
        : index === 1
          ? "2026-02-28T15:00:00.001Z"
          : null,
  }));
  const current = selectProbeRetention_(
    records,
    "2026-02-27T15:00:00.000Z",
    evaluatedAt,
  );
  const expired = selectProbeRetention_(
    records,
    "2026-02-13T15:00:00.000Z",
    evaluatedAt,
  );

  /** @param {RetentionProbeFile} file @returns {Record<string, string>} */
  function fileProperties(file) {
    return {
      purpose: "development-retention-probe",
      environment: "development",
      formatVersion: "1",
      probeRunId: runId,
      probeKind: file.kind,
      snapshotCreatedAt: file.snapshotCreatedAt,
      generationExpiresAt: file.generationExpiresAt,
    };
  }

  /** @param {RetentionProbeFile} file @param {boolean} requireDelete */
  function verifyFile(file, requireDelete) {
    try {
      if (
        !createdIds.has(file.id) ||
        file.id === configuration.backupFolderId ||
        typeof Drive === "undefined" ||
        !Drive.Files
      )
        throw new Error();
      const metadata = Drive.Files.get(file.id, {
        fields:
          "id,mimeType,parents,trashed,ownedByMe,appProperties,capabilities(canDelete)",
      });
      if (
        metadata.id !== file.id ||
        metadata.mimeType !== "application/vnd.google-apps.spreadsheet" ||
        metadata.trashed !== false ||
        metadata.ownedByMe !== true ||
        metadata.parents?.length !== 1 ||
        metadata.parents[0] !== configuration.backupFolderId ||
        (requireDelete && metadata.capabilities?.canDelete !== true)
      )
        throw new Error();
      for (const [key, value] of Object.entries(fileProperties(file))) {
        if (metadata.appProperties?.[key] !== value) throw new Error();
      }
    } catch {
      throw new Error(
        "Unable to verify development retention probe file metadata",
      );
    }
  }

  /** @param {RetentionProbeFile} file @param {RetentionProbeRecord[]} expected */
  function verifyContents(file, expected) {
    verifyFile(file, false);
    try {
      const sheet = SpreadsheetApp.openById(file.id).getSheets()[0];
      if (!sheet) throw new Error();
      const range = sheet.getDataRange();
      const rowCount = range.getNumRows();
      if (
        range.getNumColumns() !== 2 ||
        rowCount < 6 ||
        rowCount > 5 + PROBE_MAX_CHUNKS_
      )
        throw new Error();
      const restored = decodeProbeRecords_(range.getValues());
      if (JSON.stringify(restored) !== JSON.stringify(expected))
        throw new Error();
    } catch {
      throw new Error(
        "Unable to verify development retention probe file contents",
      );
    }
  }

  /**
   * @param {'original'|'replacement'|'expired'} kind
   * @param {ProbeRetentionSelection} selection
   * @param {RetentionProbeRecord[]} content
   * @returns {RetentionProbeFile}
   */
  function createFile(kind, selection, content) {
    const cells = encodeProbeRecords_(content);
    let file;
    try {
      if (createdIds.size >= 3 || typeof Drive === "undefined" || !Drive.Files)
        throw new Error();
      const descriptor = {
        id: "",
        kind,
        snapshotCreatedAt: selection.snapshotCreatedAt,
        generationExpiresAt: selection.generationExpiresAt,
      };
      const created = Drive.Files.create({
        name: `development-retention-probe-${runId}-${kind}`,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [configuration.backupFolderId],
        appProperties: fileProperties(descriptor),
      });
      if (
        typeof created.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,200}$/.test(created.id) ||
        created.id === configuration.backupFolderId ||
        createdIds.has(created.id)
      )
        throw new Error();
      createdIds.add(created.id);
      file = Object.freeze({ ...descriptor, id: created.id });
    } catch {
      throw new Error("Unable to create development retention probe file");
    }
    verifyFile(file, false);
    try {
      const sheet = SpreadsheetApp.openById(file.id).getSheets()[0];
      if (!sheet) throw new Error();
      sheet
        .getRange(1, 1, cells.length, 2)
        .setNumberFormat("@")
        .setValues(cells);
      SpreadsheetApp.flush();
    } catch {
      throw new Error("Unable to write development retention probe file");
    }
    verifyContents(file, content);
    return file;
  }

  /** @param {RetentionProbeFile} file @returns {number} */
  function httpStatus(file) {
    try {
      if (!createdIds.has(file.id)) throw new Error();
      const token = ScriptApp.getOAuthToken();
      if (
        typeof token !== "string" ||
        token.length === 0 ||
        /[\r\n]/.test(token)
      )
        throw new Error();
      /** @type {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions & {timeoutSeconds: number}} */
      const options = {
        method: "get",
        headers: { Authorization: `Bearer ${token}` },
        followRedirects: false,
        muteHttpExceptions: true,
        validateHttpsCertificates: true,
        timeoutSeconds: 30,
      };
      const response = UrlFetchApp.fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?fields=id`,
        options,
      );
      return response.getResponseCode();
    } catch {
      throw new Error(
        "Unable to check development retention probe file status",
      );
    }
  }

  /** @param {RetentionProbeFile} file */
  function permanentlyDelete(file) {
    if (file.kind === "replacement")
      throw new Error("Cannot delete retained development probe generation");
    verifyFile(file, true);
    if (httpStatus(file) !== 200)
      throw new Error(
        "Development retention probe file is not readable before deletion",
      );
    // Recheck the ownership boundary immediately before the destructive call.
    verifyFile(file, true);
    try {
      if (typeof Drive === "undefined" || !Drive.Files) throw new Error();
      Drive.Files.remove(file.id);
    } catch {
      throw new Error(
        "Unable to permanently delete development retention probe file",
      );
    }
    if (httpStatus(file) !== 404)
      throw new Error(
        "Development retention probe permanent deletion was not confirmed",
      );
  }

  const original = createFile("original", current, records);
  const replacement = createFile(
    "replacement",
    current,
    current.retainedRecords,
  );
  permanentlyDelete(original);
  verifyContents(replacement, current.retainedRecords);
  if (!expired.generationExpired || expired.retainedRecords.length !== 0) {
    throw new Error(
      "Development retention probe generation expiry was not confirmed",
    );
  }
  const expiredFile = createFile("expired", expired, records);
  permanentlyDelete(expiredFile);
  verifyContents(replacement, current.retainedRecords);

  /** @type {{status: 'verified', environment: 'development', sourceRecordCount: number, retainedRecordCount: number, expiredRecordCount: number, permanentlyDeletedFileCount: number}} */
  const result = {
    status: "verified",
    environment: configuration.environment,
    sourceRecordCount: records.length,
    retainedRecordCount: current.retainedRecords.length,
    expiredRecordCount: current.removedRecordCount,
    permanentlyDeletedFileCount: 2,
  };
  console.log(JSON.stringify(result));
  return result;
}
