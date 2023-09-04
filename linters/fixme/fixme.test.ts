import { FixtureTarget, linterCheckTest } from "tests";

const getTargetCases = (): [FixtureTarget] => {
  return [{ fixtureName: "basic.in.py", linterVersions: ["0.0.2"] }];
};

linterCheckTest("fixme", getTargetCases());