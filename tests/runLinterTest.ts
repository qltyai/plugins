import { Target, getVersionsForTarget, FIXTURES_DIR } from "tests";
import { QltyDriver } from "./driver";
import path from "path";
import * as fs from "fs";

const detectTargets = (linterName: string, dirname: string): Target[] => {
  const testDataDir = path.resolve(dirname, FIXTURES_DIR);

  const testTargets = fs
    .readdirSync(testDataDir)
    .sort()
    .reduce((accumulator: Map<string, Target>, dir_content: string) => {
      // Check if this is an input file/directory. If so, set it in the accumulator.
      const inputRegex = /(?<prefix>.+)\.in/;
      const foundIn = dir_content.match(inputRegex);
      const prefix = foundIn?.groups?.prefix;

      if (foundIn && prefix) {
        if (prefix) {
          const input = dir_content;
          const linterVersions = getVersionsForTarget(
            dirname,
            linterName,
            prefix
          );
          accumulator.set(prefix, { prefix, input, linterVersions });
        }
      }
      return accumulator;
    }, new Map<string, Target>());

  return [...testTargets.values()];
};

// Common code of linter tests.
export const runLinterTest = (
  linterName: string,
  dirname: string,
  assertFunction: (testRunResult: any, snapshotPath: string) => void
) => {
  const targets = detectTargets(linterName, dirname);

  describe(`linter=${linterName}`, () => {
    targets.forEach(({ prefix, input, linterVersions }) => {
      const fixtureBasename = input.split(".")[0];

      describe(`fixture=${fixtureBasename}`, () => {
        linterVersions.forEach((linterVersion) => {
          const driver = new QltyDriver(linterName, linterVersion);

          beforeAll(async () => {
            await driver.setUp(input);
          });

          test(`version=${linterVersion}`, async () => {
            const testRunResult = await driver.runCheck();
            expect(testRunResult).toMatchObject({
              success: true,
            });

            const snapshotPath = driver.snapshotPath(prefix);
            driver.debug("Using snapshot: %s", snapshotPath);

            assertFunction(testRunResult, snapshotPath);
          });

          afterAll(async () => {
            driver.tearDown();
          });
        });
      });
    });
  });
};
