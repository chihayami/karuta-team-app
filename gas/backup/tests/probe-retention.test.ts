import { describe, expect, it } from "vitest";
import { createProbeRuntime } from "./probe-runtime";

const createdAt = "2026-02-27T15:00:00.000Z";
const evaluatedAt = "2026-02-28T15:00:00.000Z";
const makeRuntime = () =>
  createProbeRuntime(["probe-format.js", "probe-retention.js"]);

function select(
  records: unknown,
  created = createdAt,
  evaluated = evaluatedAt,
) {
  return makeRuntime().evaluate(
    "selectProbeRetention_(input.records, input.created, input.evaluated)",
    { records, created, evaluated },
  );
}

describe("fictional generation retention", () => {
  it("removes deadlines at or before the evaluation instant and retains later or null deadlines", () => {
    const records = [
      { probeExpiresAt: "2026-02-28T14:59:59.999Z", value: "expired" },
      { probeExpiresAt: evaluatedAt, value: "expired-at-boundary" },
      {
        probeExpiresAt: "2026-02-28T15:00:00.001Z",
        value: "0007",
        optional: null,
      },
      { probeExpiresAt: null, value: "日本語と𠮷", nested: [true, 0, null] },
    ];
    const before = structuredClone(records);
    expect(select(records)).toEqual({
      snapshotCreatedAt: createdAt,
      generationExpiresAt: "2026-03-14T15:00:00.000Z",
      generationExpired: false,
      retainedRecords: records.slice(2),
      removedRecordCount: 2,
    });
    expect(records).toEqual(before);
  });

  it.each([
    { evaluated: "2026-03-14T14:59:59.999Z", expired: false },
    { evaluated: "2026-03-14T15:00:00.000Z", expired: true },
    { evaluated: "2026-03-14T15:00:00.001Z", expired: true },
  ])(
    "enforces the 15-day generation boundary at $evaluated",
    ({ evaluated, expired }) => {
      const records = [
        { probeExpiresAt: null },
        { probeExpiresAt: "2027-01-01T00:00:00.000Z" },
      ];
      expect(select(records, createdAt, evaluated)).toMatchObject({
        generationExpired: expired,
        retainedRecords: expired ? [] : records,
        removedRecordCount: expired ? 2 : 0,
      });
    },
  );

  it("retains the original generation expiry when evaluating a replacement", () => {
    const records = [{ probeExpiresAt: null }];
    const first = select(records);
    const later = select(records, createdAt, "2026-03-10T15:00:00.000Z");
    expect(first).toMatchObject({
      snapshotCreatedAt: createdAt,
      generationExpiresAt: "2026-03-14T15:00:00.000Z",
    });
    expect(later).toMatchObject({
      snapshotCreatedAt: createdAt,
      generationExpiresAt: "2026-03-14T15:00:00.000Z",
    });
  });

  it("does not resurrect expired values when every record expires before the generation", () => {
    expect(select([{ probeExpiresAt: evaluatedAt }])).toMatchObject({
      generationExpired: false,
      retainedRecords: [],
      removedRecordCount: 1,
    });
  });

  it.each(
    [
      undefined,
      "",
      "secret-canary",
      "2026-02-30T15:00:00.000Z",
      "2026-02-28T24:00:00.000Z",
      "2026-02-28T15:00:00Z",
      "2026-03-01T00:00:00.000+09:00",
      0,
      false,
    ].map((instant) => ({ instant })),
  )("rejects malformed deadline $instant", ({ instant }) => {
    expect(() => select([{ probeExpiresAt: instant }])).toThrow(
      "Invalid development retention probe input",
    );
  });

  it.each(["created", "evaluated"] as const)(
    "validates the %s timestamp without logging invalid values",
    (field) => {
      expect(() =>
        select(
          [{ probeExpiresAt: null }],
          field === "created" ? "secret-canary" : createdAt,
          field === "evaluated" ? "secret-canary" : evaluatedAt,
        ),
      ).toThrow("Invalid development retention probe input");
    },
  );

  it("rejects future snapshots", () => {
    expect(() =>
      select([{ probeExpiresAt: null }], "2026-03-01T15:00:00.000Z"),
    ).toThrow("Invalid development retention probe input");
  });

  it.each(
    [
      null,
      {},
      [],
      [null],
      [{}],
      Array.from({ length: 11 }, () => ({ probeExpiresAt: null })),
    ].map((records) => ({ records })),
  )("rejects malformed or oversize record collections", ({ records }) => {
    expect(() => select(records)).toThrow(
      "Invalid development retention probe input",
    );
  });

  it("validates row deadlines even when the whole generation has expired", () => {
    expect(() =>
      select(
        [{ probeExpiresAt: "secret-canary" }],
        createdAt,
        "2026-03-15T00:00:00.000Z",
      ),
    ).toThrow("Invalid development retention probe input");
  });

  it("rejects missing rows rather than treating them as expired records", () => {
    const records = [{ probeExpiresAt: null }, { probeExpiresAt: null }];
    delete records[0];
    expect(() => select(records)).toThrow(
      "Invalid development retention probe input",
    );
  });
});
