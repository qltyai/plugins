import { QltyDriver, linterCheckTest } from "tests";
// import * as fs from "fs";
// import * as os from "os";
import path from "path";
// import Debug from "debug";
import specific_snapshot = require("jest-specific-snapshot");
// import { Debugger } from "debug";
// import * as util from "util";
// import * as git from "simple-git";
// import { ChildProcess, execFile, execFileSync, ExecOptions, execSync } from "child_process";

// const execFilePromise = util.promisify(execFile);
const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;

// const TESTS_DIR = "tests";
const SNAPSHOTS_DIR = "__snapshots__";
// const TEMP_PREFIX = "plugins_";
// const TEMP_SUBDIR = "tmp";
// const REPO_ROOT = path.resolve(__dirname, "../..");

const linterName = "flake8";

const getVersionsForTest = (linterName: string): string[] => {
  return ["6.0.0"];
};

describe(`Testing ${linterName} `, () => {
  const linterVersions = getVersionsForTest(linterName);

  linterVersions.forEach((linterVersion) => {
    const driver = new QltyDriver(__dirname, linterName, linterVersion);
    const testTargets = driver.testTargets();

    testTargets.forEach((testTarget) => {
      const testTargetName = testTarget.split(".")[0];

      beforeAll(async () => {
        await driver.setUp();
        await driver.runQltyCmd(`plugins enable ${linterName}=${linterVersion}`);
      });

      test(`${testTargetName}_v${linterVersion}`, async () => {
        const testRunResult = await driver.runCheck();
        expect(testRunResult).toMatchObject({
          success: true,
        });

        const snapshotName = `${testTargetName}_v${linterVersion}.shot`;
        const snapshotPath = path.resolve(driver.testDir, SNAPSHOTS_DIR, snapshotName);
        driver.debug("Using snapshot: %s", snapshotPath);

        expect(testRunResult.deterministicResults).toMatchSpecificSnapshot(snapshotPath);
      });

      afterAll(async () => {
        await driver.tearDown();
      });
    });
  });
});


linterCheckTest({ linterName: "flake8" });