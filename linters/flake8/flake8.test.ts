import { linterCheckTest } from "tests";

linterCheckTest({ linterName: "flake8" });

const detectTestTargets = (): string[] => {
  return ["testA", "testB"];
};

const getVersionsForTest = (linterName: string, testTarget: string): string[] => {
  return ["version1", "version2"];
};

/**
 * Identifies snapshot file to use, based on linter, version, and ARGS.dumpNewSnapshot.
 *
 * @param snapshotDirPath absolute path to snapshot directory
 * @param linterName name of the linter being tested
 * @param prefix prefix of the file being checked
 * @param checkType "check" or "fmt"
 * @param linterVersion version of the linter that was enabled (may be undefined)
 * @param versionGreaterThanOrEqual optional comparator for sorting non-semver linter snapshots
 * @returns absolute path to the relevant snapshot file
 */
export const getSnapshotPathForAssert = (
  // snapshotDirPath: string,
  // linterName: string,
  // prefix: string,
  // checkType: CheckType,
  // linterVersion?: string,
  // versionGreaterThanOrEqual?: (_a: string, _b: string) => boolean,
): string => {
  return "path";
  // const specificVersionSnapshotName = path.resolve(
  //   snapshotDirPath,
  //   getSnapshotName(linterName, prefix, checkType, linterVersion),
  // );

  // // If this is a versionless linter, don't specify a version.
  // if (!linterVersion) {
  //   return specificVersionSnapshotName;
  // }

  // // If this is a versioned linter && dumpNewSnapshot, return its generated name.
  // // TODO(Tyler): When npm test -- -u is suggested, we should also call out PLUGINS_TEST_UPDATE_SNAPSHOTS in the output
  // if (ARGS.dumpNewSnapshot) {
  //   return specificVersionSnapshotName;
  // }

  // // Otherwise, find the most recent matching snapshot.
  // const snapshotFileRegex = getSnapshotRegex(linterName, prefix, checkType);
  // const availableSnapshots = fs
  //   .readdirSync(snapshotDirPath)
  //   .filter((name) => name.match(snapshotFileRegex))
  //   .reverse();

  // // No snapshots exist.
  // if (availableSnapshots.length === 0) {
  //   return specificVersionSnapshotName;
  // }

  // // Find the closest version such that version <= linterVersion
  // let closestMatch;
  // let closestMatchPath;
  // for (const snapshotName of availableSnapshots) {
  //   const match = snapshotName.match(snapshotFileRegex);
  //   if (match && match.groups) {
  //     const snapshotVersion = match.groups.version;
  //     const comparator = versionGreaterThanOrEqual ?? semver.gte;
  //     if (
  //       comparator(linterVersion, snapshotVersion) &&
  //       (!closestMatch || comparator(snapshotVersion, closestMatch))
  //     ) {
  //       closestMatch = snapshotVersion;
  //       closestMatchPath = path.resolve(snapshotDirPath, snapshotName);
  //     }
  //   }
  // }
  // if (closestMatchPath) {
  //   return closestMatchPath;
  // }

  // return specificVersionSnapshotName;
};

import * as fs from "fs";
import * as os from "os";
import path from "path";
import Debug from "debug";
import { Debugger } from "debug";
import * as util from "util";
import { ChildProcess, execFile, execFileSync, ExecOptions, execSync } from "child_process";

const execFilePromise = util.promisify(execFile);

const TEMP_PREFIX = "plugins_";
const TEMP_SUBDIR = "tmp";
const REPO_ROOT = path.resolve(__dirname, "../..");

export const executionEnv = (sandbox: string) => {
  const { PWD, INIT_CWD, ...strippedEnv } = process.env;
  return {
    ...strippedEnv,
    // This is necessary to prevent launcher collision of non-atomic operations
    TMPDIR: path.resolve(sandbox, TEMP_SUBDIR),
  };
};

class QltyDriver {
  testDir: string;
  sandboxPath?: string;
  linterName: string;
  linterVersion: string;
  debug: Debugger;

  constructor(testDir: string, linterName: string, linterVersion: string) {
    this.testDir = testDir;
    this.linterName = linterName;
    this.linterVersion = linterVersion;
    this.debug = Debug(`qlty:${linterName}`);
  }

  async setUp() {
    this.sandboxPath = fs.realpathSync(fs.mkdtempSync(path.resolve(os.tmpdir(), TEMP_PREFIX)));
    fs.mkdirSync(path.resolve(this.sandboxPath, TEMP_SUBDIR));
    this.debug("Created sandbox path %s from %s", this.sandboxPath, this.testDir);

    fs.cpSync(this.testDir, this.sandboxPath, {
      recursive: true,
      // filter: testCreationFilter(this.testDir),
    });

    if (!fs.existsSync(path.resolve(path.resolve(this.sandboxPath, ".qlty")))) {
      fs.mkdirSync(path.resolve(this.sandboxPath, ".qlty"), {});
    }
    fs.writeFileSync(
      path.resolve(this.sandboxPath, ".qlty/qlty.toml"),
      this.getQltyTomlContents(),
    );

    await this.runQlty(["--help"]);
  }

  tearDown() {
    if (this.sandboxPath) {
      this.debug("Cleaning up %s", this.sandboxPath);
      fs.rmSync(this.sandboxPath, { recursive: true });
    }
  }

  buildExecArgs(args: string[], execOptions?: ExecOptions): [string, string[], ExecOptions] {
    return [
      "qlty",
      args.filter((arg) => arg.length > 0),
      {
        cwd: this.sandboxPath,
        env: executionEnv(this.sandboxPath ?? ""),
        ...execOptions,
        windowsHide: true,
      },
    ];
  }

  async runQlty(
    args: string[],
    execOptions?: ExecOptions,
  ): Promise<{ stdout: string; stderr: string }> {
    return await execFilePromise(...this.buildExecArgs(args, execOptions));
  }

  getQltyTomlContents(): string {
    return `version: 0.1
plugins:
  sources:
  - id: default
    directory: ${REPO_ROOT}
lint:
  ignore:
    - linters: [ALL]
      paths:
        - tmp/**
        - node_modules/**
        - .trunk/configs/**
        - .gitattributes
`;
  }
}

const runLinterTest = ({ linterName, testTarget, linterVersion }: { linterName: string, testTarget: string, linterVersion: string }) => {
  const driver = new QltyDriver(".", linterName, linterVersion);
  // driver.setUp();

  // const testRunResult = await driver.runCheck({ args, linter: linterName });
  // expect(testRunResult).toMatchObject({
  //   success: true,
  // });

  // const snapshotDir = path.resolve(dirname, TEST_DATA);
  // const primarySnapshotPath = getSnapshotPathForAssert(
  //   snapshotDir,
  //   linterName,
  //   testName,
  //   "check",
  //   driver.enabledVersion,
  //   versionGreaterThanOrEqual,
  // );
  // debug(
  //   "Using snapshot (for dir: %s, linter: %s, version: %s) %s",
  //   snapshotDir,
  //   linterName,
  //   driver.enabledVersion ?? "no version",
  //   primarySnapshotPath,
  // );

  // expect(testRunResult.landingState).toMatchSpecificSnapshot(
  //   primarySnapshotPath,
  //   landingStateWrapper(testRunResult.landingState, primarySnapshotPath),
  // );

  driver.tearDown();
};

const linterName = "flake8";
const linterTestTargets = detectTestTargets();

describe(`Testing ${linterName} `, () => {
  linterTestTargets.forEach((testTarget) => {
    const linterVersions = getVersionsForTest(linterName, testTarget);

    linterVersions.forEach((linterVersion) => {
      const testTitle = `${testTarget} with ${linterVersion} `;
      test(testTitle, () => {
        runLinterTest({
          linterName,
          testTarget,
          linterVersion,
        });
      });
    });
  });
});
