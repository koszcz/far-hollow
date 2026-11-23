# 01: Send crashes in the published game to Sentry

**What to build:** When the published game crashes, Sentry records the crash. The owner sees it without a player filing a bug. Decided with the owner on 2026-11-23.

**Status:** resolved

**Assets:** None.

## Crash reports

- [x] The game starts the Sentry browser SDK before it loads anything else, so a crash while loading is caught.
- [x] Reports stay off on the dev server and on a local build served from localhost.
- [x] Each report names the commit it came from. CI passes `GITHUB_SHA` to the build.
- [x] Reports carry no IP address, user details or cookies.
- [x] The build publishes source maps next to the code. Sentry reads them to show the original code in a crash report.
- [x] A sample error sent with the project key reached Sentry.

## Comments

The free Sentry plan covers one user and about 5,000 errors a month. To be sure Sentry stores no IP addresses, also switch on "Prevent Storing of IP Addresses" in the Sentry project's security settings.
