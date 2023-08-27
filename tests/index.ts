import { QltyDriver } from "./driver";
import specific_snapshot = require("jest-specific-snapshot");
const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;

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
