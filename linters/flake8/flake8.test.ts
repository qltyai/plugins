import { linterCheckTest } from "tests";
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

const TESTS_DIR = "tests";
const SNAPSHOTS_DIR = "__snapshots__";
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