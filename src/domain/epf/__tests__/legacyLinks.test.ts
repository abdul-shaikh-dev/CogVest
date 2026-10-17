import { getLinkedLegacyEpfAssetIds, validateEpfLegacyLinks } from "../legacyLinks";
import type { EpfAccount } from "../model";
import type { Asset } from "@/src/types";

const account = (id: string, legacyAssetId?: string): EpfAccount => ({
  id, nickname: id, provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
  checkpoint: { date: "2026-03-01", balance: { total: 140000, components: null }, capital: null,
    source: "epfoStatement", recordedAt: "2026-03-02T00:00:00Z" },
  ...(legacyAssetId ? { legacyAssetId } : {}),
});
const asset = (id: string, overrides: Partial<Asset> = {}): Asset => ({
  id, name: id, symbol: id, ticker: id, currency: "INR", assetClass: "debt", instrumentType: "other", ...overrides,
});

test("a linked legacy holding is replaced only from the EPF checkpoint date", () => {
  const accounts = [account("a", "legacy"), account("b")];
  expect([...getLinkedLegacyEpfAssetIds(accounts, "2026-02-28")]).toEqual([]);
  expect([...getLinkedLegacyEpfAssetIds(accounts, "2026-03-01")]).toEqual(["legacy"]);
});

test("accepts explicit links to INR debt or other holdings, including untyped debt", () => {
  expect(() => validateEpfLegacyLinks([account("a", "other"), account("b", "debt"), account("c", "untyped")], [
    asset("other"), asset("debt", { instrumentType: "debt" }), asset("untyped", { instrumentType: undefined }),
  ])).not.toThrow();
  expect(() => validateEpfLegacyLinks([account("a")], [])).not.toThrow();
});

test.each([
  ["a missing asset", [account("a", "missing")], [asset("legacy")]],
  ["a quoted stock", [account("a", "stock")], [asset("stock", { assetClass: "stock", instrumentType: "stock" })]],
  ["a PPF holding", [account("a", "ppf")], [asset("ppf", { instrumentType: "ppf" })]],
  ["a foreign-currency holding", [account("a", "usd")], [asset("usd", { currency: "USD" })]],
  ["an untyped non-debt holding", [account("a", "crypto")], [asset("crypto", { assetClass: "crypto", instrumentType: undefined })]],
  ["a holding linked twice", [account("a", "legacy"), account("b", "legacy")], [asset("legacy")]],
])("rejects %s", (_, accounts, assets) => {
  expect(() => validateEpfLegacyLinks(accounts, assets)).toThrow();
});
