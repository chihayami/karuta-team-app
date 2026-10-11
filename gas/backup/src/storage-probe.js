/* exported runDevelopmentStorageProbe */

/**
 * Create a new fictional-data file and verify its persisted contents.
 * @returns {{status: 'verified', environment: 'development', recordCount: number}}
 */
function runDevelopmentStorageProbe() {
  if (arguments.length !== 0) {
    throw new Error("Development storage probe does not accept arguments");
  }
  let properties;
  try {
    properties = PropertiesService.getScriptProperties();
  } catch {
    throw new Error("Unable to access GAS script properties");
  }
  const configuration = readBackupConfiguration_(properties);
  const records = createProbeFixture_();
  const cells = encodeProbeRecords_(records);

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
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("Unable to access writable development backup folder");
  }

  let fileId;
  try {
    if (typeof Drive === "undefined" || !Drive.Files) throw new Error();
    const created = Drive.Files.create({
      name: `development-storage-probe-${Utilities.getUuid()}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [configuration.backupFolderId],
      appProperties: {
        purpose: "development-storage-probe",
        environment: "development",
        formatVersion: "1",
      },
    });
    if (
      typeof created.id !== "string" ||
      created.id.length === 0 ||
      /\s/.test(created.id)
    ) {
      throw new Error();
    }
    // Metadata-only create uses the documented one-argument signature.
    const file = Drive.Files.get(created.id, {
      fields: "id,mimeType,parents,appProperties,trashed",
    });
    if (
      file.id !== created.id ||
      file.mimeType !== "application/vnd.google-apps.spreadsheet" ||
      file.trashed !== false ||
      file.parents?.length !== 1 ||
      file.parents[0] !== configuration.backupFolderId ||
      file.appProperties?.purpose !== "development-storage-probe" ||
      file.appProperties.environment !== "development" ||
      file.appProperties.formatVersion !== "1"
    ) {
      throw new Error();
    }
    fileId = file.id;
  } catch {
    throw new Error("Unable to create development probe file");
  }

  try {
    const sheet = SpreadsheetApp.openById(fileId).getSheets()[0];
    if (!sheet) throw new Error();
    sheet.getRange(1, 1, cells.length, 2).setNumberFormat("@").setValues(cells);
    SpreadsheetApp.flush();
  } catch {
    throw new Error("Unable to write development probe file");
  }

  let persisted;
  try {
    // Reopen after flush to read persisted data rather than the input array.
    const sheet = SpreadsheetApp.openById(fileId).getSheets()[0];
    if (!sheet) throw new Error();
    const range = sheet.getDataRange();
    const rowCount = range.getNumRows();
    if (
      range.getNumColumns() !== 2 ||
      rowCount < 6 ||
      rowCount > 5 + PROBE_MAX_CHUNKS_
    )
      throw new Error();
    persisted = range.getValues();
  } catch {
    throw new Error("Unable to read development probe file");
  }

  const restored = decodeProbeRecords_(persisted);
  if (JSON.stringify(restored) !== JSON.stringify(records)) {
    throw new Error("Development storage probe verification failed");
  }
  /** @type {{status: 'verified', environment: 'development', recordCount: number}} */
  const result = {
    status: "verified",
    environment: configuration.environment,
    recordCount: records.length,
  };
  console.log(JSON.stringify(result));
  return result;
}
