import { execSync } from "child_process";

export async function fetchLatestVersionForRuby(gem: string): Promise<string> {
  const cmd = `ruby -S gem search '^${gem}$'`;

  try {
    const output: string = execSync(cmd, { encoding: 'utf8' });

    const versionString = output
      .split("\n")
      .find((line) => line.startsWith(gem))
      ?.split(/\s+/)
      .pop();

    if (!versionString) {
      throw new Error(`Failed to find latest version for ${gem}`);
    }

    const version = versionString.replace(/^\(/, "").replace(/\)$/, "");

    return version;
  } catch (error) {
    console.error(`Error fetching latest version: ${error}`);
    throw new Error(`Failed to fetch latest version for ${gem}`);
  }
}
