import { FixtureTarget, linterCheckTest } from "tests";

const getTargetCases = (): [FixtureTarget] => {
  return [{ fixtureName: "basic.in.rb", linterVersions: ["1.56.1"] }];
};

linterCheckTest("rubocop", getTargetCases());