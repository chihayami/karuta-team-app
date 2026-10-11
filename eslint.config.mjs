import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  globalIgnores(["web/.next/**", "web/next-env.d.ts", "coverage/**"]),
  {
    files: ["gas/backup/src/*.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[raw=/^[0-9].*_/]",
          message:
            "GAS同期用ソースの数値リテラルには区切り記号を使わない. Apps Scriptへの送信時に拒否された構文.",
        },
      ],
    },
    languageOptions: {
      sourceType: "script",
      globals: {
        PropertiesService: "readonly",
        Utilities: "readonly",
        Drive: "readonly",
        SpreadsheetApp: "readonly",
      },
    },
  },
  {
    files: ["gas/backup/src/healthcheck.js"],
    languageOptions: {
      globals: { readBackupConfiguration_: "readonly" },
    },
  },
  {
    files: ["gas/backup/src/storage-probe.js"],
    languageOptions: {
      globals: {
        readBackupConfiguration_: "readonly",
        createProbeFixture_: "readonly",
        encodeProbeRecords_: "readonly",
        decodeProbeRecords_: "readonly",
        PROBE_MAX_CHUNKS_: "readonly",
      },
    },
  },
  {
    files: ["gas/backup/src/retention-probe.js"],
    languageOptions: {
      globals: {
        readBackupConfiguration_: "readonly",
        createProbeFixture_: "readonly",
        encodeProbeRecords_: "readonly",
        decodeProbeRecords_: "readonly",
        selectProbeRetention_: "readonly",
        PROBE_MAX_CHUNKS_: "readonly",
        UrlFetchApp: "readonly",
        ScriptApp: "readonly",
      },
    },
  },
]);
