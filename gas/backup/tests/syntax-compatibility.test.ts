import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const eslint = new ESLint({ cwd: repositoryRoot });

async function checkLiteral(
  literal: string,
  filePath = "gas/backup/src/compatibility-fixture.js",
) {
  const results = await eslint.lintText(
    `/* exported gasLiteralFixture */\nfunction gasLiteralFixture() { return ${literal}; }`,
    { filePath },
  );
  const result = results[0];
  if (!result) throw new Error("Missing lint result");
  expect(result.messages.some((message) => message.fatal)).toBe(false);
  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-syntax",
  );
}

describe("GAS numeric literal compatibility", () => {
  it.each(["16_384", "1_000.5", "0xFF_FF", "0b1010_0000", "1_000n"])(
    "rejects numeric separators (%s) in the lint step used before push",
    async (literal) => {
      const messages = await checkLiteral(literal);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.severity).toBe(2);
    },
  );

  it.each(["16384", "1000.5", "0xFFFF", '"16_384"', "`16_384`"])(
    "allows numbers without separators and string contents (%s)",
    async (literal) => {
      expect(await checkLiteral(literal)).toHaveLength(0);
    },
  );

  it("keeps this GAS-specific restriction out of Node and Web code", async () => {
    expect(
      await checkLiteral("16_384", "web/src/platform/compatibility-fixture.js"),
    ).toHaveLength(0);
  });
});
