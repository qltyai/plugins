import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  modulePaths: ["<rootDir>"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest_setup.ts"],
  reporters: process.env.CI
    ? [["github-actions", { silent: false }], "summary"]
    : ["default"],
  modulePathIgnorePatterns: ["<rootDir>/.qlty/"],
};

export default config;
