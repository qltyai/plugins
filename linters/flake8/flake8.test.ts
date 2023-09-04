import { FixtureTarget, linterCheckTest } from "tests";

const getTargetCases = (): [FixtureTarget] => {
  return [{ fixtureName: "basic.in.py", linterVersions: ["6.0.0"] }];
};

linterCheckTest("flake8", getTargetCases());