import { QltyDriver } from "tests";
import specific_snapshot = require("jest-specific-snapshot");
const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;

const linterName = "rubocop";

const getVersionsForTest = (linterName: string): string[] => {
  return ["1.45.1"];
};

describe(linterName, () => {
  const linterVersions = getVersionsForTest(linterName);

  linterVersions.forEach((linterVersion) => {
    const driver = new QltyDriver(__dirname, linterName, linterVersion);
    const testTargets = driver.testTargets();

    testTargets.forEach((testTarget) => {
      const testTargetName = testTarget.split(".")[0];

      beforeAll(async () => {
        await driver.setUp();
      });

      test(`${testTargetName}_v${linterVersion}`, async () => {
        const testRunResult = await driver.runCheck();
        expect(testRunResult).toMatchObject({
          success: true,
        });

        const snapshotPath = driver.snapshotPath(testTargetName);
        driver.debug("Using snapshot: %s", snapshotPath);
        expect(testRunResult.deterministicResults).toMatchSpecificSnapshot(snapshotPath);
      });

      afterAll(async () => {
        await driver.tearDown();
      });
    });
  });
});