import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function signedBytes(buffer: Buffer): number[] {
  return Array.from(buffer, (byte) => (byte > 127 ? byte - 256 : byte));
}

// Match the GAS Utilities subset, including signed byte[] results.
export function createProbeUtilities() {
  return {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    newBlob(data: string | number[]) {
      const buffer =
        typeof data === "string"
          ? Buffer.from(data, "utf8")
          : Buffer.from(data);
      return {
        getBytes: () => signedBytes(buffer),
        getDataAsString(charset: string) {
          if (charset !== "UTF-8") throw new Error("Unexpected charset");
          return buffer.toString("utf8");
        },
      };
    },
    base64Encode: (bytes: number[]) => Buffer.from(bytes).toString("base64"),
    base64Decode: (value: string) => signedBytes(Buffer.from(value, "base64")),
    computeDigest(algorithm: string, bytes: number[]) {
      if (algorithm !== "SHA_256")
        throw new Error("Unexpected digest algorithm");
      return signedBytes(
        createHash("sha256").update(Buffer.from(bytes)).digest(),
      );
    },
    getUuid: () => "fictional-probe-uuid",
  };
}

export function createProbeRuntime(
  files: readonly string[],
  globals: Readonly<Record<string, unknown>> = {},
) {
  const context = createContext({
    Utilities: createProbeUtilities(),
    ...globals,
  });
  const source = files
    .map((file) =>
      readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"),
    )
    .join("\n");
  runInContext(source, context, { timeout: 1000 });
  return {
    evaluate(expression: string, input?: unknown): unknown {
      context.input = input;
      return runInContext(expression, context, { timeout: 1000 });
    },
    fixture(): unknown {
      return this.evaluate("createProbeFixture_()");
    },
    cells(): string[][] {
      const result = this.evaluate(
        "encodeProbeRecords_(createProbeFixture_())",
      );
      if (
        !Array.isArray(result) ||
        !result.every(
          (row) =>
            Array.isArray(row) && row.every((cell) => typeof cell === "string"),
        )
      ) {
        throw new Error("Unexpected probe cells");
      }
      return result.map((row) => Array.from(row, (cell) => String(cell)));
    },
  };
}
