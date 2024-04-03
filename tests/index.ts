import specific_snapshot = require("jest-specific-snapshot");
import path from "path";
import * as fs from "fs";
import { OPTIONS, serializeStructure } from "./utils";
import { runLinterTest } from "./runLinterTest";

const addSerializer = specific_snapshot.addSerializer;

export type Target = {
  prefix: string;
  input: string;
  linterVersions: any[];
};

export const FIXTURES_DIR = "fixtures";
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
) => runLinterTest(linterName, dirname, (testRunResult, snapshotPath) => {
  expect(
    testRunResult.deterministicResults()
  ).toMatchSpecificSnapshot(snapshotPath);
});

export const linterStructureTest = (
  linterName: string,
  dirname: string,
) => runLinterTest(linterName, dirname, (testRunResult, snapshotPath) => {
  addSerializer({
    test: () => true,
    print: (val: any) =>
      `Child Object Structure: ${serializeStructure(val[0])}`,
  });

  expect(
    testRunResult.runResult.outputJson
  ).toMatchSpecificSnapshot(snapshotPath);
});
