import { linterCheckTest } from "tests";

const TESTS_DIR = "tests";
const SNAPSHOTS_DIR = "__snapshots__";

linterCheckTest({ linterName: "flake8" });

const getVersionsForTest = (linterName: string, testTarget: string): string[] => {
  return ["6.0.0"];
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
import specific_snapshot = require("jest-specific-snapshot");
import { Debugger } from "debug";
import * as util from "util";
import * as git from "simple-git";
import { ChildProcess, execFile, execFileSync, ExecOptions, execSync } from "child_process";

const execFilePromise = util.promisify(execFile);
const toMatchSpecificSnapshot = specific_snapshot.toMatchSpecificSnapshot;

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
  sandboxPath: string;
  linterName: string;
  linterVersion: string;
  debug: Debugger;

  constructor(pluginDir: string, linterName: string, linterVersion: string) {
    this.testDir = path.resolve(pluginDir, TESTS_DIR);
    this.linterName = linterName;
    this.linterVersion = linterVersion;
    this.sandboxPath = fs.realpathSync(fs.mkdtempSync(path.resolve(os.tmpdir(), TEMP_PREFIX)));
    this.debug = Debug(`qlty:${linterName}`);
  }

  async setUp() {
    fs.mkdirSync(path.resolve(this.sandboxPath, TEMP_SUBDIR));
    this.debug("Created sandbox %s from %s", this.sandboxPath, this.testDir);

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

    const gitDriver = git.simpleGit(this.sandboxPath);
    await gitDriver
      .init({ "--initial-branch": "main" })
      .add(".")
      .addConfig("user.name", "User")
      .addConfig("user.email", "user@example.com")
      .addConfig("commit.gpgsign", "false")
      .addConfig("core.autocrlf", "input")
      .commit("first commit");

    await this.runQlty(["--help"]);
  }

  tearDown() {
    if (this.sandboxPath) {
      this.debug("Cleaning up %s", this.sandboxPath);
      fs.rmSync(this.sandboxPath, { recursive: true });
    }
  }

  testTargets(): string[] {
    return fs.readdirSync(this.testDir).sort().filter((target) => !target.includes(SNAPSHOTS_DIR));
  }

  async runCheck() {
    const resultJsonPath = path.resolve(this.sandboxPath, "result.json");
    const fullArgs = `check --all --output-file=${resultJsonPath} --no-progress --filter=${linterName}`;

    try {
      const { stdout, stderr } = await this.runQltyCmd(fullArgs);
      const output = fs.readFileSync(resultJsonPath, { encoding: "utf-8" });

      return this.parseRunResult(
        {
          exitCode: 0,
          stdout,
          stderr,
          outputJson: JSON.parse(output),
        }
      );
    } catch (error: any) {
      let jsonContents;

      if (fs.existsSync(resultJsonPath)) {
        jsonContents = fs.readFileSync(resultJsonPath, { encoding: "utf-8" });
      };

      if (!jsonContents) {
        jsonContents = "{}";
        console.log(error.stdout as string);
        console.log(error.stderr as string);
      }

      const runResult = {
        exitCode: error.code as number,
        stdout: error.stdout as string,
        stderr: error.stderr as string,
        outputJson: JSON.parse(jsonContents),
        error: error as Error,
      };

      if (runResult.exitCode != 1) {
        console.log(`${error.code as number} Failure running 'qlty check'`, error);
      }

      return this.parseRunResult(runResult);
    }
  }

  async runQltyCmd(
    argStr: string,
    execOptions?: ExecOptions,
  ): Promise<{ stdout: string; stderr: string }> {
    this.debug("Running qlty %s", argStr);
    return await this.runQlty(
      argStr.split(" ").filter((arg) => arg.length > 0),
      execOptions,
    );
  }

  async runQlty(
    args: string[],
    execOptions?: ExecOptions,
  ): Promise<{ stdout: string; stderr: string }> {
    return await execFilePromise(...this.buildExecArgs(args, execOptions));
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

  parseRunResult(runResult: any) {
    return {
      success: [0, 1].includes(runResult.exitCode),
      runResult,
      deterministicResults: this.tryParseDeterministicResults(this.sandboxPath, runResult.outputJson),
    };
  }

  tryParseDeterministicResults(sandboxPath: string, outputJson: any) {
    if (!outputJson) {
      return undefined;
    }

    return {
      issues: outputJson.issues
    };
  }

  getQltyTomlContents(): string {
    return `config_version = 1

[sources.default]
directory = "${REPO_ROOT}"

[runtimes.enabled]
linux = "3.17.1"
node = "19.6.0"
go = "1.20.0"
python = "3.11.2"
ruby = "3.2.1"

[plugins.enabled]
`;
  }
}

const linterName = "flake8";

describe(`Testing ${linterName} `, () => {
  const linterVersion = "6.0.0";

  test(`version ${linterVersion}`, async () => {
    const driver = new QltyDriver(__dirname, linterName, linterVersion);
    await driver.setUp();
    await driver.runQltyCmd(`plugins enable ${linterName}=${linterVersion}`);

    const testTargets = driver.testTargets();
    expect(testTargets).toEqual(["foo.py"]);

    const testRunResult = await driver.runCheck();
    expect(testRunResult).toMatchObject({
      success: true,
    });

    const snapshotName = `${linterName}_v${linterVersion}.shot`;
    const snapshotPath = path.resolve(driver.testDir, SNAPSHOTS_DIR, snapshotName);
    // expect(snapshotPath).toEqual("path");
    // const snapshotPath = driver.getSnapshotPathForAssert(testName);

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

    expect(testRunResult.deterministicResults).toMatchSnapshot();

    await driver.tearDown();
  });
});

