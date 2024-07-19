import FastGlob from "fast-glob";
import * as fs from "fs";
import path from "path";
import { FIXTURES_DIR, Target, getVersionsForTarget } from "tests";
import { QltyDriver } from "./driver";

// Currently unsupported tools on Windows
const SKIP_LINTERS = {
  win32: ["semgrep"],
} as { [key in NodeJS.Platform]: string[] };

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

  // Skip tests for Windows for now
  const suiteFn = SKIP_LINTERS[process.platform]?.includes(linterName)
    ? describe.skip
    : describe;

  suiteFn(`linter=${linterName}`, () => {
    targets.forEach(({ prefix, input, linterVersions }) => {
      const fixtureBasename = input.split(".")[0];

      describe(`fixture=${fixtureBasename}`, () => {
        linterVersions.forEach((linterVersion) => {
          const driver = new QltyDriver(linterName, linterVersion);

          beforeAll(async () => {
            await driver.setUp(input);
          });

          test(`version=${linterVersion}`, async () => {
            try {
              const testRunResult = await driver.runCheck();
              expect(testRunResult).toMatchObject({ success: true });

              const snapshotPath = driver.snapshotPath(prefix);
              driver.debug("Using snapshot: %s", snapshotPath);

              assertFunction(testRunResult, snapshotPath);
            } catch (error) {
              const logFiles = await FastGlob(
                [".qlty/logs/*", ".qlty/out/invocations/*.yaml"],
                { cwd: path.join(driver.sandboxPath) }
              );

              console.log(
                `[[linter=${linterName} fixture=${fixtureBasename} version=${linterVersion}]]:`
              );
              for (const logFile of logFiles) {
                const logFilePath = path.join(driver.sandboxPath, logFile);
                const logFileContents = fs.readFileSync(logFilePath, "utf8");
                console.log(`[${logFilePath}]:\n${logFileContents}\n\n`);
              }
              console.log("[driver logs]:");
              await driver.runCheck("--debug");
              throw error;
            }
          });

          afterAll(() => {
            driver.tearDown();
          });
        });
      });
    });
  });
};
