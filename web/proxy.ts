import { NextResponse } from "next/server";
import { ConfigurationError } from "./src/platform/environment";
import { getServerConfiguration } from "./src/platform/server-configuration";

export function proxy() {
  try {
    // Refuse before page rendering: layouts and child pages can render concurrently.
    getServerConfiguration();
    return NextResponse.next();
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return new NextResponse(
      "サービスを利用できません。時間をおいて再度お試しください。",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export const config = { matcher: "/:path*" };
