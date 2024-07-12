import { linterCheckTest } from "tests";

// only runs on macOS
if (process.platform === "darwin") {
  linterCheckTest("swiftlint", __dirname);
} else {
  test("Skipping swiftlint tests on non-macOS platform", () => {
    expect(true).toBe(true);
  });
}
