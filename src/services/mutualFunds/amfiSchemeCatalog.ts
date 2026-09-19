import { normalizeIsin } from "@/src/domain/assets";
import {
  inferMutualFundAllocationFromName,
  type MutualFundAllocation,
} from "@/src/domain/mutualFundClassification";
import type { QuoteFetcher } from "@/src/services/quotes/types";
import { getDefaultFetcher } from "@/src/services/quotes/utils";

export const amfiNavCatalogUrl =
  "https://portal.amfiindia.com/spages/NAVAll.txt";
export const AMFI_CATALOG_CACHE_MS = 15 * 60 * 1000;

export type AmfiSchemeClassification = {
  allocation?: MutualFundAllocation;
  asOf?: string;
  category: string;
  fundHouse?: string;
  nav?: number;
  schemeCode?: string;
  schemeName: string;
};

export type AmfiSchemeLookupResult = {
  classifications: Record<string, AmfiSchemeClassification>;
  failure?: string;
};

const categoryHeading = /^(?:Open Ended|Close Ended|Closed Ended|Interval) Schemes?\((.+)\)$/iu;
const amfiDate = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/u;
const monthIndexes: Record<string, number> = {
  APR: 3,
  AUG: 7,
  DEC: 11,
  FEB: 1,
  JAN: 0,
  JUL: 6,
  JUN: 5,
  MAR: 2,
  MAY: 4,
  NOV: 10,
  OCT: 9,
  SEP: 8,
};

export function parseAmfiNavDate(value: string) {
  const match = value.trim().match(amfiDate);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = monthIndexes[match[2].toUpperCase()];
  const year = Number(match[3]);
  if (month === undefined) return undefined;
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) return undefined;
  return date.toISOString();
}

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
  let fundHouse = "";

  for (const rawLine of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    const heading = line.match(categoryHeading);
    if (heading) {
      category = heading[1].trim();
      fundHouse = "";
      continue;
    }
    if (!category || !line) continue;
    if (!/^\d+;/u.test(line)) {
      if (!line.includes(";")) fundHouse = line;
      continue;
    }

    const fields = line.split(";");
    if (fields.length < 8) continue;
    const schemeCode = fields[0].trim();
    const schemeName = fields[3].trim();
    const allocation = allocationFromAmfiEvidence(category, schemeName);
    const parsedNav = Number(fields[6]);
    const parsedAsOf = parseAmfiNavDate(fields[7]);
    const validQuote = Number.isFinite(parsedNav) && parsedNav > 0 && parsedAsOf;
    const asOf = validQuote ? parsedAsOf : undefined;
    const nav = validQuote
      ? parsedNav
      : undefined;
    for (const rawIsin of [fields[1], fields[2]]) {
      const isin = normalizeIsin(rawIsin);
      if (!isin) continue;
      const prior = classifications[isin];
      const quoteConflict = Boolean(
        prior?.nav !== undefined &&
        (prior.nav !== nav || prior.asOf !== asOf),
      );
      classifications[isin] = prior && prior.allocation !== allocation
        ? { asOf: quoteConflict ? undefined : asOf, category: `${prior.category}; ${category}`, ...(fundHouse ? { fundHouse } : {}), nav: quoteConflict ? undefined : nav, schemeCode, schemeName }
        : { ...(allocation ? { allocation } : {}), asOf, category, ...(fundHouse ? { fundHouse } : {}), nav, schemeCode, schemeName };
    }
  }

  return classifications;
}

let cachedCatalog: Record<string, AmfiSchemeClassification> | undefined;
let cachedAt = 0;
let catalogRequest: Promise<Record<string, AmfiSchemeClassification>> | undefined;

async function loadCatalog(fetcher: QuoteFetcher) {
  if (cachedCatalog && Date.now() - cachedAt <= AMFI_CATALOG_CACHE_MS) {
    return cachedCatalog;
  }
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
        cachedAt = Date.now();
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
  cachedAt = 0;
  catalogRequest = undefined;
}
