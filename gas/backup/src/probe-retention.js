/* exported selectProbeRetention_ */

/**
 * @typedef {ProbeRecord & {probeExpiresAt: string|null}} RetentionProbeRecord
 * @typedef {{snapshotCreatedAt: string, generationExpiresAt: string, generationExpired: boolean, retainedRecords: RetentionProbeRecord[], removedRecordCount: number}} ProbeRetentionSelection
 */

/** @param {unknown} value @returns {number} */
function parseProbeInstant_(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    throw new Error();
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    throw new Error();
  return time;
}

/**
 * Evaluate explicit fictional deadlines, without implementing business calendars.
 * @param {RetentionProbeRecord[]} records
 * @param {string} snapshotCreatedAt
 * @param {string} evaluatedAt
 * @returns {ProbeRetentionSelection}
 */
function selectProbeRetention_(records, snapshotCreatedAt, evaluatedAt) {
  try {
    const created = parseProbeInstant_(snapshotCreatedAt);
    const evaluated = parseProbeInstant_(evaluatedAt);
    if (
      created > evaluated ||
      !Array.isArray(records) ||
      records.length < 1 ||
      records.length > 10
    ) {
      throw new Error();
    }
    const generationExpiry = created + 15 * 24 * 60 * 60 * 1000;
    const generationExpiresAt = new Date(generationExpiry).toISOString();
    parseProbeInstant_(generationExpiresAt);
    const generationExpired = generationExpiry <= evaluated;
    /** @type {RetentionProbeRecord[]} */
    const retainedRecords = [];
    for (const record of records) {
      if (!record || typeof record !== "object" || Array.isArray(record))
        throw new Error();
      const expiry =
        record.probeExpiresAt === null
          ? null
          : parseProbeInstant_(record.probeExpiresAt);
      if (!generationExpired && (expiry === null || expiry > evaluated))
        retainedRecords.push(record);
    }
    return {
      snapshotCreatedAt,
      generationExpiresAt,
      generationExpired,
      retainedRecords,
      removedRecordCount: records.length - retainedRecords.length,
    };
  } catch {
    throw new Error("Invalid development retention probe input");
  }
}
