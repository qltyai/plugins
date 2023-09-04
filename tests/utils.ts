export type LinterVersion = "KnownGoodVersion" | "Latest" | "Snapshots" | string;

export interface EnvOptions {
  /** Version of linters to enable and test against. */
  linterVersion?: LinterVersion | string;

  /** Prevents the deletion of sandbox test dirs. */
  sandboxDebug: boolean;
}

const parseLinterVersion = (value: string): LinterVersion | undefined => {
  if (value && value.length > 0) {
    return value;
  }
  return undefined;
};

export const OPTIONS: EnvOptions = {
  linterVersion: parseLinterVersion(process.env.QLTY_PLUGINS_LINTER_VERSION ?? ""),
  sandboxDebug: Boolean(process.env.QLTY_PLUGINS_SANDBOX_DEBUG),
};