import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { environmentFixture } from "../../../tests/integration/environment-fixtures";
import { readAppConfiguration } from "../platform/environment";
import { EnvironmentFooter } from "./environment-footer";

describe("TST-ENV-03: visible environment before login", () => {
  it("shows development notice and version without service settings or secret values", () => {
    const configuration = readAppConfiguration(
      {
        ...environmentFixture(),
        SERVER_SECRET_CANARY: "never-render-this-secret",
      },
      "0.1.0",
    );
    const html = renderToStaticMarkup(
      <EnvironmentFooter release={configuration.release} />,
    );
    expect(html).toContain("開発版です。データは初期化されることがあります。");
    expect(html).toContain("0.1.0-dev.abcdef1");
    expect(html).not.toContain(configuration.services.lineChannelId);
    expect(html).not.toContain(configuration.services.supabaseProjectRef);
    expect(html).not.toContain("never-render-this-secret");
  });

  it("shows the production version and SHA without the development notice", () => {
    const { release } = readAppConfiguration(
      environmentFixture("production", "production"),
      "0.1.0",
    );
    const html = renderToStaticMarkup(<EnvironmentFooter release={release} />);
    expect(html).toContain("本番版");
    expect(html).toContain("0.1.0");
    expect(html).toContain("abcdef1");
    expect(html).not.toContain("データは初期化");
    expect(html).not.toContain("-dev.");
  });
});
