import { AssetHistoryError, fetchAssetHistory } from "@/src/services/quotes/assetHistoryProvider";
import type { DailyPriceRequest } from "@/src/types";

import {
  amfiDailyNavChunks,
  buildAmfiDailyNavUrl,
  parseAmfiDailyNav,
} from "../amfiDailyNav";
import { clearAmfiHistoricalNavCacheForTests } from "../amfiHistoricalNav";
import { clearAmfiSchemeCatalogCacheForTests } from "../amfiSchemeCatalog";

const isin = "INF846K01PZ1";
const now = new Date("2026-11-24T06:00:00.000Z");
const header = "Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date";
const catalog = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  "Open Ended Schemes(Hybrid Schemes - Arbitrage Fund)",
  "",
  "Axis Mutual Fund",
  "",
  `130773;${isin};-;Axis Arbitrage Fund;Direct Plan;Growth Option;21.9580;21-Nov-2026`,
].join("\n");
const fundHouses = '{\\"mfId\\":\\"53\\",\\"mfName\\":\\"Axis Mutual Fund\\"}';
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function amfiDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}-${monthNames[Number(month) - 1]}-${year}`;
}

function navLine(date: string, nav: number, id = isin) {
  return `130773;Axis Arbitrage Fund;Direct Plan;Growth Option;${id};;${nav};${amfiDate(date)}`;
}

function weekdays(from: string, to: string) {
  const dates: string[] = [];
  for (let day = new Date(`${from}T00:00:00Z`); day <= new Date(`${to}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

function textResponse(text: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: jest.fn().mockResolvedValue(text) } as unknown as Response;
}

function reportFor(url: string, navs: (date: string) => number | undefined) {
  const params = new URL(url).searchParams;
  const parse = (value: string) => {
    const [day, month, year] = value.split("-");
    return `${year}-${String(monthNames.indexOf(month) + 1).padStart(2, "0")}-${day}`;
  };
  const lines = weekdays(parse(params.get("frmdt")!), parse(params.get("todt")!))
    .flatMap((date) => {
      const nav = navs(date);
      return nav === undefined ? [] : [navLine(date, nav), navLine(date, 99, "INF846K01ZZ9")];
    });
  return [header, "", "Axis Mutual Fund", ...lines].join("\n");
}

function amfiFetcher(navs: (date: string) => number | undefined, overrides: (url: string) => Response | undefined = () => undefined) {
  return jest.fn(async (url: string) => {
    const override = overrides(url);
    if (override) return override;
    if (url.includes("NAVAll")) return textResponse(catalog);
    if (url.includes("nav-download")) return textResponse(fundHouses);
    return textResponse(reportFor(url, navs));
  });
}

const request = (from: string, to: string): DailyPriceRequest => ({
  basis: "close", currency: "INR", from, provider: "amfi", providerId: isin, to,
});

describe("AMFI daily NAV history (#799)", () => {
  afterEach(() => {
    clearAmfiHistoricalNavCacheForTests();
    clearAmfiSchemeCatalogCacheForTests();
  });

  it("splits a range into windows of at most three calendar months", () => {
    expect(amfiDailyNavChunks("2025-11-23", "2026-11-23")).toEqual([
      { from: "2025-11-23", to: "2026-01-31" },
      { from: "2026-02-01", to: "2026-04-30" },
      { from: "2026-05-01", to: "2026-07-31" },
      { from: "2026-08-01", to: "2026-10-31" },
      { from: "2026-11-01", to: "2026-11-23" },
    ]);
    expect(amfiDailyNavChunks("2026-11-01", "2026-11-23")).toEqual([{ from: "2026-11-01", to: "2026-11-23" }]);
  });

  it("builds AMFI's report URL", () => {
    expect(buildAmfiDailyNavUrl("53", "2026-08-01", "2026-10-31")).toBe(
      "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=01-Aug-2026&mf=53&todt=31-Oct-2026",
    );
  });

  it("reads one ISIN, matching either ISIN column, and drops conflicting dates", () => {
    const text = [
      header,
      navLine("2026-11-02", 21.5),
      `130773;Axis Arbitrage Fund IDCW;Direct Plan;IDCW;INF846K01ZZ9;${isin};21.6;03-Nov-2026`,
      navLine("2026-11-04", 21.7),
      navLine("2026-11-04", 22.7),
      navLine("2026-11-05", 0),
    ].join("\n");
    const result = parseAmfiDailyNav(text, isin);
    expect([...result.navs]).toEqual([["2026-11-02", 21.5], ["2026-11-03", 21.6]]);
    expect(result.conflicts).toBe(1);
  });

  it("treats AMFI's redirect page as a rejected range", () => {
    expect(() => parseAmfiDailyNav("<html><head><title>Object moved</title></head></html>", isin))
      .toThrow("AMFI did not return a NAV history report for this range.");
  });

  it("fetches a year in chunks and returns a complete INR NAV series", async () => {
    const fetcher = amfiFetcher((date) => 20 + Number(date.slice(5, 7)) / 10);
    const entry = await fetchAssetHistory(request("2025-11-23", "2026-11-23"), undefined, fetcher, now);
    const reports = fetcher.mock.calls.map(([url]) => url).filter((url) => url.includes("DownloadNAVHistoryReport"));
    expect(reports).toHaveLength(5);
    expect(entry).toMatchObject({ complete: true, currency: "INR", provider: "amfi", providerId: isin });
    expect(entry.points[0]).toEqual({ close: 21.1, date: "2025-11-24" });
    expect(entry.points.at(-1)).toEqual({ close: 21.1, date: "2026-11-23" });
    expect(entry.points).toHaveLength(weekdays("2025-11-23", "2026-11-23").length);
  });

  it("marks a short or missing chunk as partial history", async () => {
    const truncated = amfiFetcher((date) => (date >= "2026-02-01" && date <= "2026-03-20" ? 20 : date < "2026-02-01" || date > "2026-04-30" ? 21 : undefined));
    const short = await fetchAssetHistory(request("2025-11-23", "2026-11-23"), undefined, truncated, now);
    expect(short.complete).toBe(false);

    const gap = amfiFetcher((date) => (date >= "2026-05-01" && date <= "2026-07-31" ? undefined : 21));
    expect((await fetchAssetHistory(request("2025-11-23", "2026-11-23"), undefined, gap, now)).complete).toBe(false);
  });

  it("marks a fund launched inside the range as partial, not as a gap", async () => {
    const fetcher = amfiFetcher((date) => (date >= "2026-06-15" ? 30 : undefined));
    const entry = await fetchAssetHistory(request("2025-11-23", "2026-11-23"), undefined, fetcher, now);
    expect(entry.complete).toBe(false);
    expect(entry.points[0].date).toBe("2026-06-15");
  });

  it("reports provider, offline and unknown-fund failures as history errors", async () => {
    const rejected = amfiFetcher(() => 21, (url) => (url.includes("DownloadNAVHistoryReport") ? textResponse("<html>Object moved</html>") : undefined));
    await expect(fetchAssetHistory(request("2026-11-01", "2026-11-23"), undefined, rejected, now))
      .rejects.toMatchObject({ kind: "provider-error" });

    const failing = amfiFetcher(() => 21, (url) => (url.includes("DownloadNAVHistoryReport") ? textResponse("", 503) : undefined));
    await expect(fetchAssetHistory(request("2026-11-01", "2026-11-23"), undefined, failing, now))
      .rejects.toThrow("AMFI NAV history request failed with status 503.");

    const offline = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(fetchAssetHistory(request("2026-11-01", "2026-11-23"), undefined, offline, now))
      .rejects.toMatchObject({ kind: "offline" });

    clearAmfiSchemeCatalogCacheForTests();
    const unknown = amfiFetcher(() => 21);
    await expect(fetchAssetHistory({ ...request("2026-11-01", "2026-11-23"), providerId: "INF000000000" }, undefined, unknown, now))
      .rejects.toMatchObject({ kind: "unsupported" });

    const empty = amfiFetcher(() => undefined);
    await expect(fetchAssetHistory(request("2026-11-01", "2026-11-23"), undefined, empty, now))
      .rejects.toBeInstanceOf(AssetHistoryError);
  });

  it("refuses ranges longer than the fund limit and non-INR requests", async () => {
    const fetcher = amfiFetcher(() => 21);
    await expect(fetchAssetHistory(request("2021-11-23", "2026-11-23"), undefined, fetcher, now))
      .rejects.toMatchObject({ kind: "invalid-data" });
    await expect(fetchAssetHistory({ ...request("2026-11-01", "2026-11-23"), currency: "USD" }, undefined, fetcher, now))
      .rejects.toMatchObject({ kind: "invalid-data" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
