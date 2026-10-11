import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createProbeRuntime, createProbeUtilities } from "./probe-runtime";

const makeRuntime = () => createProbeRuntime(["probe-format.js"]);

function rawCells(payload: Buffer, count = 3): string[][] {
  const encoded = payload.toString("base64");
  const chunks = encoded.match(/.{1,512}/g) ?? [];
  return [
    ["probe-format", "v1"],
    ["environment", "development"],
    ["record-count", `n:${count}`],
    ["sha256", `sha256:${createHash("sha256").update(payload).digest("hex")}`],
    ["chunk-count", `n:${chunks.length}`],
    ...chunks.map((chunk, index) => [`chunk:${index}`, `b64:${chunk}`]),
  ];
}

describe("development probe storage format", () => {
  it("preserves NULL, empty strings, dates, JSON, Unicode, leading zeros and formula-like text", () => {
    const runtime = makeRuntime();
    const restored = runtime.evaluate(
      "decodeProbeRecords_(input)",
      runtime.cells(),
    );
    expect(restored).toEqual(runtime.fixture());
    expect(restored).toMatchObject([
      {
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
        memberCode: "0012",
        amount: 12.5,
        optionalValue: "",
        date: "2024-02-29",
        timestamp: "2026-10-11T09:00:00+09:00",
        formulaLike: "+0012",
      },
      {
        amount: -7,
        optionalValue: "null",
        metadata: { label: "日本語と𠮷" },
        formulaLike: "@SUM(1,2)",
      },
    ]);
  });

  it("stores only prefixed strings with an independently verified UTF-8 checksum", () => {
    const runtime = makeRuntime();
    const cells = runtime.cells();
    const digest = createHash("sha256")
      .update(JSON.stringify(runtime.fixture()), "utf8")
      .digest("hex");
    expect(cells[3]).toEqual(["sha256", `sha256:${digest}`]);
    expect(cells.length).toBeGreaterThan(6);
    for (const row of cells) {
      for (const cell of row) expect(cell).toMatch(/^[a-z]/);
    }
    expect(JSON.stringify(cells)).not.toContain("HYPERLINK");
    expect(JSON.stringify(cells)).not.toContain("架空の実証用データ");
  });

  it.each([
    ["unknown format", 0, 1, "v2"],
    ["production", 1, 1, "production"],
    ["unexpected metadata key", 1, 0, "unknown"],
    ["record count mismatch", 2, 1, "n:2"],
    ["noncanonical record count", 2, 1, "n:03"],
    ["numeric cell coercion", 2, 1, 3],
    ["checksum mismatch", 3, 1, `sha256:${"0".repeat(64)}`],
    ["malformed checksum", 3, 1, "sha256:bad"],
    ["chunk count mismatch", 4, 1, "n:1"],
    ["noncanonical chunk count", 4, 1, "n:03"],
    ["unexpected chunk index", 5, 0, "chunk:1"],
    ["unprefixed payload", 5, 1, "AAAA"],
    ["malformed Base64", 5, 1, `b64:${"!".repeat(512)}`],
    ["empty chunk", 5, 1, "b64:"],
    ["oversize chunk", 5, 1, `b64:${"A".repeat(513)}`],
  ] as const)(
    "rejects %s without echoing cell data",
    (_name, row, column, value) => {
      const runtime = makeRuntime();
      const cells: unknown[][] = runtime.cells();
      const target = cells[row];
      if (!target) throw new Error("Missing test row");
      target[column] = value;
      expect(() =>
        runtime.evaluate("decodeProbeRecords_(input)", cells),
      ).toThrow("Invalid development probe data");
    },
  );

  it.each(
    [null, {}, [], [["secret-canary"]], "secret-canary"].map((cells) => ({
      cells,
    })),
  )("rejects malformed cell matrices ($cells)", ({ cells }) => {
    expect(() =>
      makeRuntime().evaluate("decodeProbeRecords_(input)", cells),
    ).toThrow("Invalid development probe data");
  });

  it.each([
    "missing chunk",
    "duplicate chunk",
    "extra column",
    "too many rows",
  ])("rejects %s", (mutation) => {
    const runtime = makeRuntime();
    const cells = runtime.cells();
    const firstChunk = cells[5];
    if (!firstChunk) throw new Error("Missing test chunk");
    if (mutation === "missing chunk") cells.pop();
    if (mutation === "duplicate chunk") cells.push([...firstChunk]);
    if (mutation === "extra column") firstChunk.push("secret-canary");
    if (mutation === "too many rows")
      cells.push(...Array.from({ length: 50 }, () => [...firstChunk]));
    expect(() => runtime.evaluate("decodeProbeRecords_(input)", cells)).toThrow(
      "Invalid development probe data",
    );
  });

  it("rejects altered payload bytes even when its Base64 structure is valid", () => {
    const runtime = makeRuntime();
    const cells = runtime.cells();
    const row = cells[5];
    if (!row?.[1]) throw new Error("Missing test chunk");
    row[1] =
      row[1].slice(0, 4) + (row[1][4] === "A" ? "B" : "A") + row[1].slice(5);
    expect(() => runtime.evaluate("decodeProbeRecords_(input)", cells)).toThrow(
      "Invalid development probe data",
    );
  });

  it.each([
    Buffer.from("secret-canary invalid JSON"),
    Buffer.from('{"secret-canary":true}'),
    Buffer.from("[1,2]"),
    Buffer.concat([
      Buffer.from('["'),
      Buffer.from([255]),
      Buffer.from('",null,null]'),
    ]),
    Buffer.from(JSON.stringify(["x".repeat(16_384), null, null])),
  ])("rejects invalid payloads with valid checksums", (payload) => {
    expect(() =>
      makeRuntime().evaluate("decodeProbeRecords_(input)", rawCells(payload)),
    ).toThrow("Invalid development probe data");
  });

  it("rejects noncanonical Base64 pad bits", () => {
    const cells = rawCells(Buffer.from("[1]"), 1);
    // [1] has no padding; use the one-record payload [10], encoded WzEwXQ==.
    const padded = rawCells(Buffer.from("[10]"), 1);
    padded[5] = ["chunk:0", "b64:WzEwXR=="];
    expect(makeRuntime().evaluate("decodeProbeRecords_(input)", cells)).toEqual(
      [1],
    );
    expect(() =>
      makeRuntime().evaluate("decodeProbeRecords_(input)", padded),
    ).toThrow("Invalid development probe data");
  });

  it.each(
    [
      [],
      Array.from({ length: 11 }, () => ({})),
      [{ text: "𠮷".repeat(5000) }],
    ].map((records) => ({ records })),
  )("rejects records beyond the probe count or byte limit", ({ records }) => {
    expect(() =>
      makeRuntime().evaluate("encodeProbeRecords_(input)", records),
    ).toThrow("Unable to encode development probe records");
  });

  it("sanitizes Utilities failures", () => {
    const runtime = createProbeRuntime(["probe-format.js"], {
      Utilities: {
        ...createProbeUtilities(),
        newBlob: () => {
          throw new Error("service-secret-canary");
        },
      },
    });
    expect(() => runtime.cells()).toThrow(
      "Unable to encode development probe records",
    );
  });

  it("accepts the byte limit and refuses a payload one byte larger", () => {
    const overhead = Buffer.byteLength(JSON.stringify(["", null, null]));
    const records = ["x".repeat(16_384 - overhead), null, null];
    const payload = Buffer.from(JSON.stringify(records));
    expect(payload.length).toBe(16_384);
    expect(
      makeRuntime().evaluate("decodeProbeRecords_(input)", rawCells(payload)),
    ).toEqual(records);
    const tooLarge = Buffer.from(
      JSON.stringify([`${records[0]}x`, null, null]),
    );
    expect(tooLarge.length).toBe(16_385);
    expect(() =>
      makeRuntime().evaluate("decodeProbeRecords_(input)", rawCells(tooLarge)),
    ).toThrow("Invalid development probe data");
  });

  it("rejects sparse rows and sparse cells without coercing them to strings", () => {
    const runtime = makeRuntime();
    const rows = runtime.cells();
    delete rows[5];
    expect(() => runtime.evaluate("decodeProbeRecords_(input)", rows)).toThrow(
      "Invalid development probe data",
    );
    const cells = runtime.cells();
    const row = cells[5];
    if (!row) throw new Error("Missing test chunk");
    delete row[1];
    expect(() => runtime.evaluate("decodeProbeRecords_(input)", cells)).toThrow(
      "Invalid development probe data",
    );
  });
});
