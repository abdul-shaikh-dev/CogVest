import { normalizeIsin } from "@/src/domain/assets";
import {
  inferMutualFundAllocationFromName,
  type MutualFundAllocation,
} from "@/src/domain/mutualFundClassification";
import type { QuoteFetcher } from "@/src/services/quotes";
import { getDefaultFetcher } from "@/src/services/quotes/utils";

export const amfiNavCatalogUrl =
  "https://portal.amfiindia.com/spages/NAVAll.txt";

export type AmfiSchemeClassification = {
  allocation?: MutualFundAllocation;
  category: string;
  schemeName: string;
};

export type AmfiSchemeLookupResult = {
  classifications: Record<string, AmfiSchemeClassification>;
  failure?: string;
};

const categoryHeading = /^(?:Open Ended|Close Ended|Closed Ended|Interval) Schemes?\((.+)\)$/iu;

export function allocationFromAmfiEvidence(
  category: string,
  schemeName: string,
): MutualFundAllocation | undefined {
  const normalizedCategory = category.trim().toUpperCase();
  if (/^EQUITY SCHEMES?\b/u.test(normalizedCategory)) return "equity";
  if (/^DEBT SCHEMES?\b/u.test(normalizedCategory)) return "debt";
  if (/^HYBRID SCHEMES?\b/u.test(normalizedCategory)) return undefined;
  return inferMutualFundAllocationFromName(schemeName);
}

export function parseAmfiSchemeCatalog(text: string) {
  const classifications: Record<string, AmfiSchemeClassification> = {};
  let category = "";

  for (const rawLine of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    const heading = line.match(categoryHeading);
    if (heading) {
      category = heading[1].trim();
      continue;
    }
    if (!category || !/^\d+;/u.test(line)) continue;

    const fields = line.split(";");
    if (fields.length < 4) continue;
    const schemeName = fields[3].trim();
    const allocation = allocationFromAmfiEvidence(category, schemeName);
    for (const rawIsin of [fields[1], fields[2]]) {
      const isin = normalizeIsin(rawIsin);
      if (!isin) continue;
      const prior = classifications[isin];
      classifications[isin] = prior && prior.allocation !== allocation
        ? { category: `${prior.category}; ${category}`, schemeName }
        : { ...(allocation ? { allocation } : {}), category, schemeName };
    }
  }

  return classifications;
}

let cachedCatalog: Record<string, AmfiSchemeClassification> | undefined;
let catalogRequest: Promise<Record<string, AmfiSchemeClassification>> | undefined;

async function loadCatalog(fetcher: QuoteFetcher) {
  if (cachedCatalog) return cachedCatalog;
  if (!catalogRequest) {
    catalogRequest = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetcher(amfiNavCatalogUrl, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`AMFI catalogue request failed with status ${response.status}.`);
        }
        const parsed = parseAmfiSchemeCatalog(await response.text());
        if (Object.keys(parsed).length === 0) {
          throw new Error("AMFI catalogue contained no scheme identities.");
        }
        cachedCatalog = parsed;
        return parsed;
      } finally {
        clearTimeout(timeout);
      }
    })().finally(() => {
      catalogRequest = undefined;
    });
  }
  return catalogRequest;
}

export async function lookupAmfiSchemeClassifications({
  fetcher = getDefaultFetcher(),
  isins,
}: {
  fetcher?: QuoteFetcher;
  isins: string[];
}): Promise<AmfiSchemeLookupResult> {
  try {
    const catalog = await loadCatalog(fetcher);
    return {
      classifications: Object.fromEntries(
        isins
          .map(normalizeIsin)
          .filter((isin): isin is string => Boolean(isin && catalog[isin]))
          .map((isin) => [isin, catalog[isin]]),
      ),
    };
  } catch {
    return {
      classifications: {},
      failure: "AMFI fund categories are unavailable. Review any fund CogVest cannot classify safely.",
    };
  }
}

export function clearAmfiSchemeCatalogCacheForTests() {
  cachedCatalog = undefined;
  catalogRequest = undefined;
}
