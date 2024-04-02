import { QltyDriver } from "./driver";
import specific_snapshot = require("jest-specific-snapshot");
import path from "path";
import * as fs from "fs";
import { OPTIONS, serializeStructure } from "./utils";

const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;
const addSerializer = specific_snapshot.addSerializer;

export type Target = {
  prefix: string;
  input: string;
  linterVersions: any[];
};

const FIXTURES_DIR = "fixtures";

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

const SNAPSHOTS_DIR = "__snapshots__";

export const getVersionsForTarget = (
  dirname: string,
  linterName: string,
  prefix: string
) => {
  let matchExists = false;
  const snapshotsDir = path.resolve(dirname, FIXTURES_DIR, SNAPSHOTS_DIR);

  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir);
  }

  const versionsList = fs
    .readdirSync(snapshotsDir)
    .map((file) => {
      const fileMatch = file.match(getSnapshotRegex(prefix));

      if (fileMatch) {
        matchExists = true;
        return fileMatch.groups?.version;
      }
    })
    .filter(Boolean);

  const uniqueVersionsList = Array.from(new Set(versionsList)).sort();

  if (OPTIONS.linterVersion) {
    return [OPTIONS.linterVersion];
  } else {
    // // Check if no snapshots exist yet. If this is the case, run with KnownGoodVersion and Latest, and print advisory text.
    // if (!matchExists && !OPTIONS.linterVersion) {
    //   console.log(
    //     `No snapshots detected for ${linterName} ${prefix} test. Running test against KnownGoodVersion. See tests/readme.md for more information.`,
    //   );
    //   return ["KnownGoodVersion"];
    // }
    return uniqueVersionsList;
  }
};

export const getSnapshotRegex = (prefix: string) =>
  `${prefix}(_v(?<version>[^_]+))?.shot`;

export const linterCheckTest = (
  linterName: string,
  dirname: string,
  structure_test?: boolean
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

            if (structure_test) {
              addSerializer({
                test: () => true,
                print: (val: any) =>
                  `Child Object Structure: ${serializeStructure(val[0])}`,
              });

              expect(
                testRunResult.runResult.outputJson
              ).toMatchSpecificSnapshot(snapshotPath);
            } else {
              expect(
                testRunResult.deterministicResults
              ).toMatchSpecificSnapshot(snapshotPath);
            }
          });

          afterAll(async () => {
            await driver.tearDown();
          });
        });
      });
    });
  });
};
