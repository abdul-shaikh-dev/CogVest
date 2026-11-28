import type { Asset, AssetClass, InstrumentType, SectorBasis, SectorType } from "@/src/types";

/**
 * Sector and ETF suggestions from a fund's name (#823).
 *
 * Index funds and ETFs say what they hold in their name ("Nifty IT",
 * "Bank BeES", "Gold ETF"), so a sector can be suggested for them. Company
 * shares never get a suggestion: "Bank of Baroda" is a bank, but its name is
 * not a sector label, and a share's sector is the user's call.
 *
 * Suggestions only replace a default sector (Unknown, or Diversified on an
 * ETF) that the user didn't choose, and existing records change only after
 * the user confirms them. A suggested sector records "schemeName" as its
 * basis, and a fund whose name points overseas is marked international.
 */

type Rule = { pattern: RegExp; sector: SectorType };

// Fund houses whose name would read as a sector.
const fundHousePrefixes = [/^\s*bank of india\b/i, /^\s*baroda bnp paribas\b/i];

// Order matters: debt and cash words first ("Banking & PSU Debt" is a debt
// fund, not a bank), then single sectors, then broad indices and categories
// ("Nifty Bank" is a bank index, not the broad Nifty).
const nameRules: Rule[] = [
  {
    pattern: /\b(gilt|bonds?|debt|g-?sec|gsec|sdl|treasury|credit risk|corporate bond|banking\s*(&|and)\s*psu|floater|floating rate|target maturity|(ultra |very )?short duration|medium duration|long duration|low duration|dynamic bond|constant maturity)\b/i,
    sector: "fixedIncome",
  },
  { pattern: /\b(liquid|overnight|money market|arbitrage|1d rate)\b/i, sector: "liquidity" },
  { pattern: /\b(gold|silver|precious metals?)\b/i, sector: "commodities" },
  // "IT" only as a capitalised whole word, so "Quant Infrastructure" or a
  // lower-case "it" in a description never reads as technology.
  { pattern: /\bIT\b/, sector: "technology" },
  { pattern: /\b(technology|tech|digital|nasdaq|fang\+?)\b/i, sector: "technology" },
  { pattern: /\b(banks?|banking|financials?|finance|fin ?serv(ices)?)\b/i, sector: "financialServices" },
  { pattern: /\b(pharma|healthcare|health care|hospitals?|medical)\b/i, sector: "healthcare" },
  { pattern: /\b(auto|automobiles?|automotive|fmcg|consumption|consumer|retail)\b/i, sector: "consumer" },
  { pattern: /\b(energy|oil|gas)\b/i, sector: "energy" },
  { pattern: /\b(power|utilities)\b/i, sector: "utilities" },
  { pattern: /\b(infra(structure)?|manufacturing|capital goods|defen[cs]e|industrials?)\b/i, sector: "industrial" },
  { pattern: /\b(metals?|mining)\b/i, sector: "materials" },
  { pattern: /\b(realty|real estate)\b/i, sector: "realEstate" },
  { pattern: /\b(media|telecom)\b/i, sector: "communicationServices" },
  {
    pattern: /\b(nifty|sensex|s&p|index|flexi ?cap|multi ?cap|large ?cap|mid ?cap|small ?cap|large\s*(&|and)\s*mid|elss|tax saver|bluechip|focused|value|contra|dividend yield|psu|cpse|equity|hybrid|balanced advantage|multi asset|momentum|quality|low vol(atility)?|alpha|next 50|junior)\b/i,
    sector: "diversified",
  },
];

// Exchange tickers for ETFs whose saved name says nothing more, such as
// "ITBEES" or "GOLDBEES".
const tickerRules: Rule[] = [
  { pattern: /^(LIQUID|LIQ)/, sector: "liquidity" },
  { pattern: /^(GOLD|SILVER)/, sector: "commodities" },
  { pattern: /^(IT|TECH)(BEES|IETF|ETF)|^(MON100|MAFANG|NASDAQ|MASPTOP50)/, sector: "technology" },
  { pattern: /BANK|BNK|FIN/, sector: "financialServices" },
  { pattern: /^(PHARMA|HEALTH)/, sector: "healthcare" },
  { pattern: /^(AUTO|CONSUM|FMCG)/, sector: "consumer" },
  { pattern: /^INFRA/, sector: "industrial" },
  { pattern: /^(NIFTY|JUNIOR|NEXT50|SENSEX|MID|SMALL|CPSE|PSU|NV20|MOM|LOWVOL|QUAL|ALPHA)/, sector: "diversified" },
];

// Funds and ETFs that hold securities listed outside India. "US" counts only
// as a capitalised whole word ("US Bluechip"), so "us" in a phrase never does.
const internationalName = /\b(nasdaq|s\s?&\s?p\s?500|nyse|fang\+?|international|global|overseas|world|worldwide|developed markets?|emerging markets?|hang seng|japan|china|greater china|taiwan|europe(an)?|asia pacific|ex[- ]india)\b|\bU\.S\./i;
const internationalUs = /\bUS\b/;
const internationalTicker = /^(MON100|MAFANG|MASPTOP50|HNGSNGBEES|MAHKTECH|NASDAQ|SP500)/;

const fundOfFunds = /\b(fund of funds?|fof)\b/i;
const etfName = /\b(etf|bees)\b/i;
const etfTicker = /(BEES|IETF|ETF)$/i;
const fundInstruments: InstrumentType[] = ["mutualFund", "arbitrageFund", "liquidFund", "etf"];

function fundName(name: string) {
  return fundHousePrefixes.reduce((value, prefix) => value.replace(prefix, " "), name);
}

function tickerSymbol(asset: Pick<Asset, "symbol" | "ticker">) {
  return (asset.symbol || asset.ticker || "").replace(/\.(NS|BO)$/i, "").toUpperCase();
}

/** The sector a fund or ETF's name or ticker states, or undefined when it says nothing. */
export function suggestFundSector(asset: Pick<Asset, "name" | "symbol" | "ticker">): SectorType | undefined {
  const name = fundName(asset.name ?? "");
  const fromName = nameRules.find((rule) => rule.pattern.test(name))?.sector;
  if (fromName) return fromName;
  const ticker = tickerSymbol(asset);
  return ticker ? tickerRules.find((rule) => rule.pattern.test(ticker))?.sector : undefined;
}

/** A fund or ETF whose name or ticker says it holds securities listed outside India. */
export function suggestsInternational(asset: Pick<Asset, "name" | "symbol" | "ticker">) {
  const name = fundName(asset.name ?? "");
  return internationalName.test(name) || internationalUs.test(name) || internationalTicker.test(tickerSymbol(asset));
}

/**
 * An exchange-listed ETF saved as a company share: an NSE or BSE listing
 * whose name or ticker says ETF, and whose ISIN (when known) is a fund's.
 * A fund of funds is a mutual fund, not an ETF.
 */
export function looksLikeListedEtf(asset: Asset) {
  if (asset.assetClass !== "stock") return false;
  if (asset.instrumentType !== undefined && asset.instrumentType !== "stock") return false;
  if (asset.exchange !== "NSE" && asset.exchange !== "BSE") return false;
  if (asset.isin && !asset.isin.toUpperCase().startsWith("INF")) return false;
  if (fundOfFunds.test(asset.name)) return false;
  return etfName.test(asset.name) || etfTicker.test(tickerSymbol(asset));
}

/** A fund or ETF, the only records a name can classify. */
export function isFundLike(asset: Asset) {
  return asset.assetClass === "etf"
    || fundInstruments.includes(asset.instrumentType as InstrumentType)
    || looksLikeListedEtf(asset);
}

/**
 * Unknown, or the Diversified an ETF gets by default, which a name can
 * improve on. A sector the user chose is never a default, even Unknown.
 */
export function isDefaultSector(asset: Pick<Asset, "assetClass" | "sectorBasis" | "sectorType">) {
  if (asset.sectorBasis === "user") return false;
  return asset.sectorType === undefined
    || asset.sectorType === "other"
    || (asset.sectorType === "diversified" && asset.assetClass === "etf");
}

export type AssetClassification = {
  assetClass: AssetClass;
  instrumentType?: InstrumentType;
  international?: boolean;
  sectorBasis?: SectorBasis;
  sectorType?: SectorType;
};

export type AssetClassificationSuggestion = {
  assetId: string;
  current: AssetClassification;
  next: AssetClassification;
  /** The name says the fund holds overseas securities, and the record isn't marked yet. */
  markInternational: boolean;
  /** The record is an exchange ETF saved as a company share. */
  reclassifyAsEtf: boolean;
  /** The suggested sector replaces a default one. */
  sectorChanged: boolean;
};

/**
 * What the name suggests for one record, or undefined when nothing would
 * change. Demerger-linked records are left alone.
 */
export function suggestAssetClassification(asset: Asset): AssetClassificationSuggestion | undefined {
  if (asset.demerger || !isFundLike(asset)) return undefined;
  const reclassifyAsEtf = looksLikeListedEtf(asset);
  const suggested = isDefaultSector(asset) ? suggestFundSector(asset) : undefined;
  const sectorChanged = suggested !== undefined && suggested !== asset.sectorType;
  // Only an unset marker is suggested; a user's "not international" stays.
  const markInternational = asset.international === undefined && suggestsInternational(asset);
  if (!reclassifyAsEtf && !sectorChanged && !markInternational) return undefined;
  const current: AssetClassification = {
    assetClass: asset.assetClass,
    instrumentType: asset.instrumentType,
    international: asset.international,
    sectorBasis: asset.sectorBasis,
    sectorType: asset.sectorType,
  };
  return {
    assetId: asset.id,
    current,
    next: {
      assetClass: reclassifyAsEtf ? "etf" : asset.assetClass,
      instrumentType: reclassifyAsEtf ? "etf" : asset.instrumentType,
      international: markInternational ? true : asset.international,
      sectorBasis: sectorChanged ? "schemeName" : asset.sectorBasis,
      sectorType: sectorChanged ? suggested : asset.sectorType,
    },
    markInternational,
    reclassifyAsEtf,
    sectorChanged,
  };
}

export function suggestPortfolioClassifications(assets: Asset[]) {
  return assets.flatMap((asset) => suggestAssetClassification(asset) ?? []);
}

/**
 * Applies the name's sector to a record being created (lookup or import),
 * only when the record is a fund and its sector is still the default, and
 * marks a fund whose name points overseas as international.
 */
export function withSuggestedFundSector<T extends Asset>(asset: T): T {
  if (asset.demerger || !isFundLike(asset)) return asset;
  const sectorType = isDefaultSector(asset) ? suggestFundSector(asset) : undefined;
  const international = asset.international === undefined && suggestsInternational(asset);
  if (!sectorType && !international) return asset;
  return {
    ...asset,
    ...(sectorType ? { sectorBasis: "schemeName" as const, sectorType } : {}),
    ...(international ? { international: true } : {}),
  };
}
