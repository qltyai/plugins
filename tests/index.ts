import { QltyDriver } from "./driver";
import specific_snapshot = require("jest-specific-snapshot");
const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;

export type LinterVersion = "KnownGoodVersion" | "Latest" | "Snapshots" | string;

export interface EnvOptions {
  /** Version of linters to enable and test against. */
  linterVersion?: LinterVersion | string;

  /** Prevents the deletion of sandbox test dirs. */
  sandboxDebug: boolean;
}

const parseLinterVersion = (value: string): LinterVersion | undefined => {
  if (value && value.length > 0) {
    return value;
  }
  return undefined;
};

export const OPTIONS: EnvOptions = {
  linterVersion: parseLinterVersion(process.env.QLTY_PLUGINS_LINTER_VERSION ?? ""),
  sandboxDebug: Boolean(process.env.QLTY_PLUGINS_SANDBOX_DEBUG),
};

export type FixtureTarget = {
  fixtureName: string;
  linterVersions: string[];
};

export const linterCheckTest = (linterName: string, fixtureTargets: [FixtureTarget]) => {
  describe(`linter=${linterName}`, () => {
    fixtureTargets.forEach(({ fixtureName, linterVersions }) => {
      const fixtureBasename = fixtureName.split(".")[0];

      describe(`fixture=${fixtureBasename}`, () => {
        linterVersions.forEach((linterVersion) => {
          const driver = new QltyDriver(linterName, linterVersion);

          beforeAll(async () => {
            await driver.setUp();
          });

          test(`version=${linterVersion}`, async () => {
            const testRunResult = await driver.runCheck();
            expect(testRunResult).toMatchObject({
              success: true,
            });

            const snapshotPath = driver.snapshotPath(fixtureBasename);
            driver.debug("Using snapshot: %s", snapshotPath);
            expect(testRunResult.deterministicResults).toMatchSpecificSnapshot(snapshotPath);
          });

          afterAll(async () => {
            await driver.tearDown();
          });
        });
      });
    });
  });
};
