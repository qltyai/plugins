import { execSync } from "child_process";

export async function fetchLatestVersionForNode(
  nodePackage: string
): Promise<string> {
  const cmd = `npm view ${nodePackage} version`;

  try {
    const output: string = execSync(cmd, { encoding: 'utf8' });
    const versionString = output.trim();

    return versionString;
  } catch (error) {
    console.error(`Error fetching latest version: ${error}`);
    throw new Error(`Failed to fetch latest version for ${nodePackage}`);
  }
}
