import { linterCheckTest, QltyDriver } from "tests";
import specific_snapshot = require("jest-specific-snapshot");
const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;

const getTargetCases = () => {
  return {
    flake8: [{ target: "basic.py", linterVersions: ["6.0.0"] }]
  };
};

let targetCases = getTargetCases();

Object.entries(targetCases).forEach(([linterName, targetVersions]) => {
  describe(`linter=${linterName}`, () => {
    targetVersions.forEach(({ target, linterVersions }) => {
      const targetName = target.split(".")[0];

      describe(`target=${targetName}`, () => {
        linterVersions.forEach((linterVersion) => {
          const driver = new QltyDriver(__dirname, linterName, linterVersion);

          beforeAll(async () => {
            await driver.setUp();
          });

          test(`version=${linterVersion}`, async () => {
            const testRunResult = await driver.runCheck();
            expect(testRunResult).toMatchObject({
              success: true,
            });

            const snapshotPath = driver.snapshotPath(targetName);
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
});

linterCheckTest();