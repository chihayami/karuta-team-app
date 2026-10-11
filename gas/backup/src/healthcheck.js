/* exported checkDevelopmentSetup */

/**
 * Validate settings without accessing Drive, the DB, or other properties.
 * @returns {{status: 'configured', environment: 'development', backupFolderConfigured: true}}
 */
function checkDevelopmentSetup() {
  let properties;
  try {
    properties = PropertiesService.getScriptProperties();
  } catch {
    throw new Error("Unable to access GAS script properties");
  }

  const configuration = readBackupConfiguration_(properties);
  /** @type {{status: 'configured', environment: 'development', backupFolderConfigured: true}} */
  const result = {
    status: "configured",
    environment: configuration.environment,
    backupFolderConfigured: true,
  };

  // The result reports configuration only; it does not claim folder access.
  console.log(JSON.stringify(result));
  return result;
}
