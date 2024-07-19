import { execFile, ExecOptions } from "child_process";
import Debug, { Debugger } from "debug";
import * as fs from "fs";
import * as os from "os";
import path from "path";
import * as git from "simple-git";
import * as util from "util";
import { OPTIONS } from "./utils";

const execFilePromise = util.promisify(execFile);

const FIXTURES_DIR = "fixtures";
const TEMP_PREFIX = "plugins_";
const TEMP_SUBDIR = "tmp";
const SNAPSHOTS_DIR = "__snapshots__";
export const REPO_ROOT = path.resolve(__dirname, "..");

export const executionEnv = (sandbox: string) => {
  const { PWD, INIT_CWD, ...strippedEnv } = process.env;
  return {
    ...strippedEnv,
    // This is necessary to prevent launcher collision of non-atomic operations
    TMPDIR: path.resolve(sandbox, TEMP_SUBDIR),
  };
};

const testCreationFilter = (input: string) => (file: string) => {
  // Don't copy snapshot files
  if (file.endsWith(".shot")) {
    return false;
  }

  // Only copy the input file if it matches the target
  const name = path.basename(file) || "";
  if (name.includes(".in") && input != name) {
    return false;
  }

  return true;
};

export class QltyDriver {
  fixturesDir: string;
  sandboxPath: string;
  linterName: string;
  linterVersion: string;
  debug: Debugger;

  constructor(linterName: string, linterVersion: string) {
    const pluginDir = path.resolve(REPO_ROOT, "linters", linterName);
    this.fixturesDir = path.resolve(pluginDir, FIXTURES_DIR);
    this.linterName = linterName;
    this.linterVersion = linterVersion;
    this.sandboxPath = fs.realpathSync(
      fs.mkdtempSync(path.resolve(os.tmpdir(), TEMP_PREFIX))
    );
    this.debug = Debug(`qlty:${linterName}`);
  }

  async setUp(input: string) {
    fs.mkdirSync(path.resolve(this.sandboxPath, TEMP_SUBDIR));
    this.debug(
      "Created sandbox %s from %s",
      this.sandboxPath,
      this.fixturesDir
    );

    const input_path = path.join(this.fixturesDir, input);

    // Copy contents of input if it is a directory, otherwise copy the input file
    const stats = fs.statSync(input_path);
    if (stats.isDirectory()) {
      fs.cpSync(input_path, this.sandboxPath, {
        recursive: true,
      });
    } else {
      fs.cpSync(this.fixturesDir, this.sandboxPath, {
        recursive: true,
        filter: testCreationFilter(input),
      });
    }

    if (!fs.existsSync(path.resolve(path.resolve(this.sandboxPath, ".qlty")))) {
      fs.mkdirSync(path.resolve(this.sandboxPath, ".qlty"), {});
    }

    fs.writeFileSync(
      path.resolve(this.sandboxPath, ".qlty", "qlty.toml"),
      this.getQltyTomlContents()
    );

    fs.writeFileSync(
      path.resolve(this.sandboxPath, ".gitignore"),
      this.getGitIgnoreContents()
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

    await this.runQltyCmd(
      `plugins enable ${this.linterName}=${this.linterVersion}`
    );
  }

  tearDown() {
    if (this.sandboxPath && !OPTIONS.sandboxDebug) {
      this.debug("Cleaning up %s", this.sandboxPath);
      fs.rmSync(this.sandboxPath, { recursive: true });
    } else {
      this.debug("Leaving sandbox %s", this.sandboxPath);
    }
  }

  testTargets(): string[] {
    return fs
      .readdirSync(this.fixturesDir)
      .sort()
      .filter(
        (target) => !target.includes(SNAPSHOTS_DIR) && !target.startsWith(".")
      );
  }

  snapshotPath(prefix: string): string {
    const snapshotName = `${prefix}_v${this.linterVersion}.shot`;
    return path.resolve(this.fixturesDir, SNAPSHOTS_DIR, snapshotName);
  }

  async runCheck() {
    const fullArgs = `check --all --json --no-fail --no-cache --no-progress --filter=${this.linterName}`;

    let output = { stdout: "", stderr: "" };
    try {
      let env = {
        ...executionEnv(this.sandboxPath ?? ""),
        QLTY_LOG_STDERR: "1",
        QLTY_LOG: "trace",
      };
      output = await this.runQltyCmd(fullArgs, { env });

      return this.parseRunResult({
        ...output,
        exitCode: 0,
        outputJson: JSON.parse(output.stdout),
      });
    } catch (error: any) {
      let jsonContents = "{}";

      const runResult = {
        ...output,
        exitCode: error.code as number,
        outputJson: JSON.parse(jsonContents),
        error: error as Error,
      };

      if (runResult.exitCode != 1) {
        console.log(
          `${error.code as number} Failure running 'qlty check'`,
          error
        );
      }

      return this.parseRunResult(runResult);
    }
  }

  async runQltyCmd(
    argStr: string,
    execOptions?: ExecOptions
  ): Promise<{ stdout: string; stderr: string }> {
    this.debug("Running qlty %s", argStr);
    return await this.runQlty(
      argStr.split(" ").filter((arg) => arg.length > 0),
      execOptions
    );
  }

  async runQlty(
    args: string[],
    execOptions?: ExecOptions
  ): Promise<{ stdout: string; stderr: string }> {
    return await execFilePromise(...this.buildExecArgs(args, execOptions));
  }

  buildExecArgs(
    args: string[],
    execOptions?: ExecOptions
  ): [string, string[], ExecOptions] {
    return [
      "qlty",
      args.filter((arg) => arg.length > 0),
      {
        cwd: this.sandboxPath,
        ...execOptions,
        windowsHide: true,
      },
    ];
  }

  parseRunResult(runResult: {
    stdout: string;
    stderr: string;
    exitCode: number;
    outputJson: any;
  }) {
    return {
      success: [0].includes(runResult.exitCode),
      runResult,
      deterministicResults: this.tryParseDeterministicResults(
        this.sandboxPath,
        runResult.outputJson
      ),
    };
  }

  tryParseDeterministicResults(sandboxPath: string, outputJson: any) {
    // return function to lazy evaluate sorting and skip if not needed
    return () => {
      if (!outputJson) {
        return undefined;
      }

      outputJson.sort((a: any, b: any) => {
        if (a.tool < b.tool) {
          return -1;
        }
        if (a.tool > b.tool) {
          return 1;
        }
        if (a.ruleKey < b.ruleKey) {
          return -1;
        }
        if (a.ruleKey > b.ruleKey) {
          return 1;
        }
        if (a.path < b.path) {
          return -1;
        }
        if (a.path > b.path) {
          return 1;
        }
        if (a.message < b.message) {
          return -1;
        }
        if (a.message > b.message) {
          return 1;
        }
        return 0;
      });

      // make results deterministic by removing the sandbox path
      outputJson.forEach((issue: any) => {
        if (issue.message.includes(sandboxPath)) {
          issue.message = issue.message.replace(sandboxPath, "");
        }
      });

      return {
        issues: outputJson,
      };
    };
  }

  getQltyTomlContents(): string {
    return `config_version = "0"

[sources.default]
directory = ${JSON.stringify(REPO_ROOT)}
`;
  }

  getGitIgnoreContents(): string {
    return `.qlty/logs/
.qlty/out/
/tmp/
`;
  }
}
