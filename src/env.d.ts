// The build fills these in: scripts/build.ts for production, scripts/dev-env-plugin.ts for the dev server.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
  // The commit the build came from, so a crash report names the version. Set only by scripts/build.ts.
  readonly RELEASE: string;
}
