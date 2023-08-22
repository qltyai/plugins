import { linterCheckTest } from "tests";

linterCheckTest({ linterName: "flake8" });

const detectTestTargets = (): string[] => {
  return ["testA", "testB"];
};

const getVersionsForTest = (linterName: string, testTarget: string): string[] => {
  return ["version1", "version2"];
};

const runLinterTest = ({ linterName, testTarget, linterVersion }: { linterName: string, testTarget: string, linterVersion: string }) => {
  expect(3).toBe(3);
};

const linterName = "flake8";
const linterTestTargets = detectTestTargets();

describe(`Testing ${linterName}`, () => {
  linterTestTargets.forEach((testTarget) => {
    const linterVersions = getVersionsForTest(linterName, testTarget);

    linterVersions.forEach((linterVersion) => {
      const testTitle = `${testTarget} with ${linterVersion}`;
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
