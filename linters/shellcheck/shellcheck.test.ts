import { FixtureTarget, linterCheckTest } from "tests";

const getTargetCases = (): [FixtureTarget] => {
  return [{ fixtureName: "basic.in.sh", linterVersions: ["0.9.0"] }];
};

linterCheckTest("shellcheck", getTargetCases());