import { linterCheckTest } from "tests";

// only runs on macOS
if (process.platform === "darwin") {
  linterCheckTest("swiftlint", __dirname);
}
