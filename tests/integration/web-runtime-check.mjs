import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { environmentFixture } from "./environment-fixtures.ts";

const artifact = JSON.parse(
  readFileSync("web/.next/required-server-files.json", "utf8"),
);
const build = artifact.config.env;
assert.equal(
  build.APP_BUILD_ENVIRONMENT,
  "development",
  "Use a development build for this isolated check",
);

async function reservePort() {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert(address && typeof address === "object");
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function checkRuntime(overrides, check) {
  const port = await reservePort();
  const childEnvironment = {
    ...process.env,
    ...environmentFixture("development", "local"),
    APP_GIT_SHA: build.APP_BUILD_GIT_SHA,
    APP_CONFIG_REVISION: build.APP_BUILD_CONFIG_REVISION,
    ...overrides,
  };
  // The smoke server uses only fixture settings, independently of its host.
  for (const field of Object.keys(childEnvironment)) {
    if (field.startsWith("VERCEL")) delete childEnvironment[field];
  }
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "web",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { env: childEnvironment, stdio: ["ignore", "pipe", "pipe"] },
  );
  let startupError;
  child.on("error", (error) => {
    startupError = error;
  });
  // Drain logs without reprinting configuration or error traces.
  child.stdout.resume();
  child.stderr.resume();
  try {
    const url = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 15_000;
    let response;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      assert.equal(
        child.exitCode,
        null,
        "Smoke server exited before responding",
      );
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        break;
      } catch {
        await delay(100);
      }
    }
    assert(response, "Smoke server timed out");
    await check(response, url);
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      const forceStop = setTimeout(() => child.kill("SIGKILL"), 5000);
      try {
        await exited;
      } finally {
        clearTimeout(forceStop);
      }
    }
  }
}

await checkRuntime({}, async (response, url) => {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-powered-by"), null);
  const html = await response.text();
  assert(html.includes('lang="ja"'));
  assert(html.includes("会員活動を、もっと身近に。"));
  assert(html.includes("開発版です。データは初期化されることがあります。"));
  assert(
    html.includes(
      `${build.APP_BUILD_SOURCE_VERSION}-dev.${build.APP_BUILD_GIT_SHA.slice(0, 7)}`,
    ),
  );
  assert(!html.includes("aaaaaaaaaaaaaaaaaaaa"));
  assert(!html.includes("1000000001"));
  const missing = await fetch(`${url}/not-a-real-page`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(missing.status, 404);
  assert((await missing.text()).includes("開発版です。"));
});

await checkRuntime(
  { APP_CONFIG_REVISION: "changed-without-rebuild" },
  async (response) => {
    assert.equal(
      response.status,
      503,
      "A stale build must refuse before rendering",
    );
    const html = await response.text();
    assert(!html.includes("changed-without-rebuild"));
    assert(!html.includes("会員活動を、もっと身近に。"));
  },
);

console.log(
  "HTTP smoke passed: page, 404, version, headers, and stale-build refusal",
);
