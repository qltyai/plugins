import { addSerializer, toMatchSpecificSnapshot } from "jest-specific-snapshot";
import specific_snapshot = require("jest-specific-snapshot");
import { serializeStructure } from "./utils";
import { runLinterTest } from "./runLinterTest";

export const testResults: { [k: string]: boolean } = {};

expect.extend({
  toMatchSpecificSnapshot(received: any, snapshotPath: string, ...rest: any[]) {
    const result = (toMatchSpecificSnapshot as any).call(
      this,
      received,
      snapshotPath,
      ...rest
    );
    if (this.currentTestName) {
      testResults[this.currentTestName] = result.pass;
    }
    return result;
  },
});

export const linterCheckTest = (linterName: string, dirname: string) =>
  runLinterTest(linterName, dirname, (testRunResult, snapshotPath) => {
    expect(testRunResult.deterministicResults()).toMatchSpecificSnapshot(
      snapshotPath
    );
  });

export const linterStructureTest = (linterName: string, dirname: string) =>
  runLinterTest(linterName, dirname, (testRunResult, snapshotPath) => {
    addSerializer({
      test: () => true,
      print: (val: any) => {
        if (val[0]) {
          return `Child Object Structure: ${serializeStructure(val[0])}`;
        } else {
          return "No issues found.";
        }
      },
    });

    expect(testRunResult.runResult.outputJson).toMatchSpecificSnapshot(
      snapshotPath
    );
  });
