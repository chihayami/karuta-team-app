import type { ReleaseInfo } from "../platform/environment";

export function EnvironmentFooter({
  release,
}: {
  readonly release: ReleaseInfo;
}) {
  const development = release.environment === "development";
  return (
    <footer className="environment-footer" aria-label="環境とバージョン">
      {development && (
        <p className="development-notice">
          開発版です。データは初期化されることがあります。
        </p>
      )}
      <p>
        <span
          className={
            development ? "environment-badge development" : "environment-badge"
          }
        >
          {development ? "開発版" : "本番版"}
        </span>{" "}
        <span>{release.displayVersion}</span>{" "}
        <span className="source-sha">({release.gitSha.slice(0, 7)})</span>
      </p>
    </footer>
  );
}
