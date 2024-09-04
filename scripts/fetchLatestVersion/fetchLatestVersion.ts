import { fetchLatestVersionFromGithub } from "./github";
import { fetchLatestVersionForRunnableArchive } from "./runnableArchive";
import { fetchLatestVersionForRuby } from "./ruby";
import { fetchLatestVersionForPython } from "./python";
import { fetchLatestVersionForNode } from "./node";
import { getLinterDef } from "scripts/updateLinterVersions";

const getLatestVersionForRuntime = async (
  runtime: string,
  linterDef: any
): Promise<string> => {
  switch (runtime) {
    case "java": {
      return fetchLatestVersionForRunnableArchive(
        linterDef.runnable_archive_url
      );
    }
    case "php": {
      return fetchLatestVersionForRunnableArchive(
        linterDef.runnable_archive_url
      );
    }
    case "ruby": {
      return fetchLatestVersionForRuby(linterDef.package);
    }
    case "python": {
      return fetchLatestVersionForPython(linterDef.package);
    }
    case "node": {
      return fetchLatestVersionForNode(linterDef.package);
    }
    default: {
      throw new Error(`Unknown runtime: ${runtime}`);
    }
  }
};

export const fetchLatestVersion = async (linter: string): Promise<string> => {
  const linterDef = getLinterDef(linter);

  const releases = linterDef.plugins.definitions[linter].releases;
  if (releases && releases.length > 0) {
    return fetchLatestVersionFromGithub(linterDef.plugins.releases[releases[0]].github);
  }

  const runtime = linterDef.plugins.definitions[linter].runtime;
  if (runtime) {
    return getLatestVersionForRuntime(
      runtime,
      linterDef.plugins.definitions[linter]
    );
  }

  throw new Error(`Failed to fetch latest version for ${linter}`);
};
