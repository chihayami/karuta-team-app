import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EnvironmentFooter } from "../src/components/environment-footer";
import { getServerConfiguration } from "../src/platform/server-configuration";
import "./globals.css";

export const metadata: Metadata = {
  title: "会員向けサービス",
  description: "会員活動のためのサービス",
  robots: { index: false, follow: false },
};

// Configuration is checked for every request, including pages before login.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { release } = getServerConfiguration();
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main-content">
          本文へ移動
        </a>
        <header className="site-header">
          <span>会員向けサービス</span>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <EnvironmentFooter release={release} />
      </body>
    </html>
  );
}
