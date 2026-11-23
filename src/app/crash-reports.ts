// Sends crashes in the published game to Sentry, so the owner sees them without a player filing a bug.
// It stays off on the dev server and on a local preview build, so testing never sends a report.
import * as Sentry from "@sentry/browser";

// The project key is public by design. Every page that uses Sentry ships it.
const SENTRY_DSN = "https://73b737bfe6ffb78c19eb65fb4bb8c07a@o4512483198173184.ingest.de.sentry.io/4512483202629712";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function startCrashReports(): void {
  if (import.meta.env.DEV || LOCAL_HOSTS.has(window.location.hostname)) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    release: import.meta.env.RELEASE,
    // Send no IP address, user details or cookies.
    dataCollection: { userInfo: false, cookies: false },
  });
}
