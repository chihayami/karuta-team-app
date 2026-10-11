/* exported createProbeFixture_, encodeProbeRecords_, decodeProbeRecords_ */

/**
 * @typedef {{caseName: string, memberCode: string, amount: number, active: boolean, optionalValue: null|string, date: string, timestamp: string, metadata: {flags: boolean[], label: string, empty: null}, formulaLike: string}} ProbeRecord
 */

// These are probe limits, not claims about Sheets capacity or DB backup support.
const PROBE_MAX_BYTES_ = 16384;
const PROBE_CHUNK_LENGTH_ = 512;
const PROBE_MAX_CHUNKS_ = Math.ceil(
  (Math.ceil(PROBE_MAX_BYTES_ / 3) * 4) / PROBE_CHUNK_LENGTH_,
);

/** @returns {ProbeRecord[]} */
function createProbeFixture_() {
  return [
    {
      caseName: "null-and-leading-zero",
      memberCode: "0007",
      amount: 0,
      active: false,
      optionalValue: null,
      date: "2026-10-11",
      timestamp: "2026-10-11T00:00:00.000Z",
      metadata: {
        flags: [true, false],
        label: "架空の実証用データ",
        empty: null,
      },
      formulaLike: '=HYPERLINK("https://example.invalid", "fixture")',
    },
    {
      caseName: "empty-string-and-decimal",
      memberCode: "0012",
      amount: 12.5,
      active: true,
      optionalValue: "",
      date: "2024-02-29",
      timestamp: "2026-10-11T09:00:00+09:00",
      metadata: { flags: [], label: '改行\nタブ\t引用符"', empty: null },
      formulaLike: "+0012",
    },
    {
      caseName: "unicode-and-negative-number",
      memberCode: "0000",
      amount: -7,
      active: true,
      optionalValue: "null",
      date: "2000-01-01",
      timestamp: "2000-01-01T00:00:00.123Z",
      metadata: { flags: [false], label: "日本語と𠮷", empty: null },
      formulaLike: "@SUM(1,2)",
    },
  ];
}

/** @param {number[]} bytes @returns {string} */
function probeDigest_(bytes) {
  // GAS returns signed bytes. Convert each to unsigned before hex encoding.
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map((byte) => (byte & 255).toString(16).padStart(2, "0"))
    .join("");
}

/** @param {ProbeRecord[]} records @returns {string[][]} */
function encodeProbeRecords_(records) {
  try {
    if (!Array.isArray(records) || records.length < 1 || records.length > 10) {
      throw new Error();
    }
    const bytes = Utilities.newBlob(JSON.stringify(records)).getBytes();
    if (bytes.length > PROBE_MAX_BYTES_) throw new Error();
    const encoded = Utilities.base64Encode(bytes);
    const chunks = [];
    for (
      let offset = 0;
      offset < encoded.length;
      offset += PROBE_CHUNK_LENGTH_
    ) {
      chunks.push(encoded.slice(offset, offset + PROBE_CHUNK_LENGTH_));
    }
    // Every metadata and payload value starts with text, preventing cell coercion.
    return [
      ["probe-format", "v1"],
      ["environment", "development"],
      ["record-count", `n:${records.length}`],
      ["sha256", `sha256:${probeDigest_(bytes)}`],
      ["chunk-count", `n:${chunks.length}`],
      ...chunks.map((chunk, index) => [`chunk:${index}`, `b64:${chunk}`]),
    ];
  } catch {
    throw new Error("Unable to encode development probe records");
  }
}

/** @param {unknown} input @returns {unknown[]} */
function decodeProbeRecords_(input) {
  try {
    if (
      !Array.isArray(input) ||
      input.length < 6 ||
      input.length > 5 + PROBE_MAX_CHUNKS_
    )
      throw new Error();

    /** @type {string[][]} */
    const cells = [];
    for (let index = 0; index < input.length; index++) {
      const row = input[index];
      if (!Array.isArray(row) || row.length !== 2) throw new Error();
      const key = row[0];
      const value = row[1];
      if (
        typeof key !== "string" ||
        typeof value !== "string" ||
        key.length > PROBE_CHUNK_LENGTH_ + 4 ||
        value.length > PROBE_CHUNK_LENGTH_ + 4
      ) {
        throw new Error();
      }
      cells.push([key, value]);
    }
    const field = (/** @type {number} */ index, /** @type {string} */ key) => {
      const row = cells[index];
      if (!row || row[0] !== key || typeof row[1] !== "string")
        throw new Error();
      return row[1];
    };
    if (
      field(0, "probe-format") !== "v1" ||
      field(1, "environment") !== "development"
    ) {
      throw new Error();
    }
    const recordCount = field(2, "record-count");
    const digest = field(3, "sha256");
    const chunkCount = field(4, "chunk-count");
    if (
      !/^n:([1-9]|10)$/.test(recordCount) ||
      !/^sha256:[a-f0-9]{64}$/.test(digest) ||
      !/^n:[1-9][0-9]*$/.test(chunkCount) ||
      Number(chunkCount.slice(2)) !== cells.length - 5
    ) {
      throw new Error();
    }
    const encoded = cells
      .slice(5)
      .map((row, index, chunks) => {
        if (row[0] !== `chunk:${index}` || !row[1]?.startsWith("b64:"))
          throw new Error();
        const chunk = row[1].slice(4);
        if (
          chunk.length < 1 ||
          (index < chunks.length - 1 && chunk.length !== PROBE_CHUNK_LENGTH_)
        ) {
          throw new Error();
        }
        return chunk;
      })
      .join("");
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded,
      )
    ) {
      throw new Error();
    }
    const bytes = Utilities.base64Decode(encoded);
    if (
      bytes.length > PROBE_MAX_BYTES_ ||
      Utilities.base64Encode(bytes) !== encoded ||
      `sha256:${probeDigest_(bytes)}` !== digest
    )
      throw new Error();
    const json = Utilities.newBlob(bytes).getDataAsString("UTF-8");
    if (Utilities.base64Encode(Utilities.newBlob(json).getBytes()) !== encoded)
      throw new Error();
    /** @type {unknown} */
    const records = JSON.parse(json);
    if (
      !Array.isArray(records) ||
      records.length !== Number(recordCount.slice(2))
    )
      throw new Error();
    return records;
  } catch {
    // Do not propagate parser or service errors containing the stored content.
    throw new Error("Invalid development probe data");
  }
}
