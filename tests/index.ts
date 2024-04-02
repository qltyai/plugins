import { QltyDriver } from "./driver";
import specific_snapshot = require("jest-specific-snapshot");
import path from "path";
import * as fs from "fs";
import { OPTIONS } from "./utils";

const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;

export type Target = {
  prefix: string;
  filename: string;
  linterVersions: any[];
};

const FIXTURES_DIR = "fixtures";

const detectTargets = (linterName: string, dirname: string): Target[] => {
  const testDataDir = path.resolve(dirname, FIXTURES_DIR);

  const testTargets = fs
    .readdirSync(testDataDir)
    .sort()
    .reduce((accumulator: Map<string, Target>, file: string) => {
      // Check if this is an input file/directory. If so, set it in the accumulator.
      const inFileRegex = /(?<prefix>.+)\.in/;
      const foundIn = file.match(inFileRegex);
      const prefix = foundIn?.groups?.prefix;

      if (foundIn && prefix) {
        if (prefix) {
          const filename = file;
          const linterVersions = getVersionsForTarget(dirname, linterName, prefix);
          accumulator.set(prefix, { prefix, filename, linterVersions });
          return accumulator;
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
  prefix: string,
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

export const linterCheckTest = (linterName: string, dirname: string) => {
  const targets = detectTargets(linterName, dirname);

  describe(`linter=${linterName}`, () => {
    targets.forEach(({ prefix, filename, linterVersions }) => {
      const fixtureBasename = filename.split(".")[0];

      describe(`fixture=${fixtureBasename}`, () => {
        linterVersions.forEach((linterVersion) => {
          const driver = new QltyDriver(linterName, linterVersion);

          beforeAll(async () => {
            await driver.setUp(filename);
          });

          test(`version=${linterVersion}`, async () => {
            const testRunResult = await driver.runCheck();
            expect(testRunResult).toMatchObject({
              success: true,
            });

            const snapshotPath = driver.snapshotPath(prefix);
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
