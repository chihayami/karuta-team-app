/* exported readBackupConfiguration_ */

/**
 * @typedef {{getProperty: (name: string) => unknown}} BackupPropertyStore
 * @typedef {{environment: 'development', backupFolderId: string}} BackupConfiguration
 */

/**
 * @param {BackupPropertyStore} properties
 * @param {string} name
 * @returns {unknown}
 */
function readBackupProperty_(properties, name) {
  try {
    return properties.getProperty(name);
  } catch {
    // Service errors may include data; expose only the fixed property name.
    throw new Error(`Unable to read GAS script property: ${name}`);
  }
}

/**
 * @param {BackupPropertyStore} properties
 * @returns {BackupConfiguration}
 */
function readBackupConfiguration_(properties) {
  const environment = readBackupProperty_(properties, "APP_ENVIRONMENT");
  if (environment !== "development") {
    throw new Error("APP_ENVIRONMENT must be development");
  }

  const backupFolderId = readBackupProperty_(properties, "BACKUP_FOLDER_ID");
  if (
    typeof backupFolderId !== "string" ||
    backupFolderId.length === 0 ||
    /\s/.test(backupFolderId)
  ) {
    throw new Error(
      "BACKUP_FOLDER_ID must be a non-empty ID without whitespace",
    );
  }

  return { environment, backupFolderId };
}
