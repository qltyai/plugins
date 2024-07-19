import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  modulePaths: ["<rootDir>"],
  modulePathIgnorePatterns: ["<rootDir>/.qlty/"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest_setup.ts"],
  reporters: process.env.CI
    ? [["github-actions", { silent: false }], "default"]
    : ["default"],
};

export default config;
