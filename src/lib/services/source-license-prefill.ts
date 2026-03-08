export type SourceLicensePrefillRule = {
  hosts: string[];
  licenses: string[];
};

export const UNITY_ASSET_STORE_LICENSE = "Unity Asset Store EULA";

const DEFAULT_SOURCE_LICENSE_PREFILL_RULES: SourceLicensePrefillRule[] = [
  {
    hosts: ["assetstore.unity.com", "assetstore.unity3d.com"],
    licenses: [UNITY_ASSET_STORE_LICENSE],
  },
];

export class SourceLicensePrefillHelper {
  private readonly rules: SourceLicensePrefillRule[];

  constructor(
    rules: SourceLicensePrefillRule[] = DEFAULT_SOURCE_LICENSE_PREFILL_RULES,
  ) {
    this.rules = rules;
  }

  getPrefillLicensesForSourceUrl(sourceUrl: string): string[] {
    const hostname = this.getSourceHostname(sourceUrl);
    if (!hostname) return [];

    const matchedLicenses = this.rules.flatMap((rule) => {
      const hostMatches = rule.hosts.some(
        (host) => hostname === host || hostname.endsWith(`.${host}`),
      );
      return hostMatches ? rule.licenses : [];
    });

    return Array.from(new Set(matchedLicenses));
  }

  private getSourceHostname(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      return new URL(withProtocol).hostname.toLowerCase();
    } catch {
      const fallbackHost = trimmed
        .toLowerCase()
        .match(/[a-z0-9.-]+\.[a-z]{2,}/i);
      return fallbackHost?.[0] ?? null;
    }
  }
}
