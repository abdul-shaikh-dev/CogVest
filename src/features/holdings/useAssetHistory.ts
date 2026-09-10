import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/src/types";
import { createDailyPriceCache, type DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import { AssetHistoryError, fetchAssetHistory, getAssetHistoryRequest } from "@/src/services/quotes/assetHistoryProvider";

type HistoryState = {
  key: string;
  entry?: DailyPriceEntry;
  loading: boolean;
  message?: string;
  freshness?: "current" | "stale";
  holdingSafe?: boolean;
};

// Session-only verification cannot survive a failed disk invalidation/restart.
// Price cache remains usable offline; raw share quantities need this extra gate.
const verifiedYahooEntries = new Set<string>();
const verificationKey = (entry: DailyPriceEntry) => JSON.stringify([entry.providerId, entry.currency, entry.basis, entry.from, entry.to, entry.fetchedAt]);

export function useAssetHistory(asset: Asset, from: string, to: string, suppliedCache?: ReturnType<typeof createDailyPriceCache>) {
  const request = getAssetHistoryRequest(asset, from, to);
  const key = JSON.stringify(request);
  const cacheRef = useRef<ReturnType<typeof createDailyPriceCache> | null>(null);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<HistoryState>({ key: "", loading: true });

  useEffect(() => {
    let active = true;
    if (!request) {
      setState({ key, loading: false, message: "Market history is not available for this asset. Your saved records are unchanged." });
      return;
    }
    const cache = suppliedCache ?? cacheRef.current ?? (cacheRef.current = createDailyPriceCache());
    const cached = cache.read(request);
    if (cached.status === "incompatible" || cached.status === "unavailable") {
      setState({ key, loading: false, message: "History storage is unavailable. Your portfolio is unaffected." });
      return;
    }
    if (cached.status === "corrupt") cache.clear();
    const holdingSafe = request.provider !== "yahoo" || Boolean(suppliedCache) ||
      (cached.status === "hit" && verifiedYahooEntries.has(verificationKey(cached.entry)));
    const initial: HistoryState = cached.status === "hit"
      ? { key, entry: cached.entry, freshness: cached.freshness, loading: false, holdingSafe }
      : { key, loading: true };
    setState(initial);
    if (cached.status === "hit" && cached.freshness === "current" && cached.coverage === "complete" && holdingSafe && revision === 0) return;
    setState({ ...initial, loading: true });
    let failure: string | undefined;
    let blocked = false;
    void cache.refresh(request, async (input, signal) => {
      try {
        return await fetchAssetHistory(input, signal);
      } catch (error) {
        failure = error instanceof AssetHistoryError ? error.message : "Unable to refresh history. Check your connection and retry.";
        if (error instanceof AssetHistoryError && error.kind === "corporate-action") {
          // Earlier price windows may share the newly invalid adjustment basis.
          // Clear only disposable history and fence other in-flight cache writes.
          blocked = true;
          verifiedYahooEntries.clear();
          cache.clear();
        }
        throw error;
      }
    }).then((result) => {
      if (!active) return;
      const latest = cache.read(request);
      if (result.status === "refreshed" && latest.status === "hit" && request.provider === "yahoo") {
        if (verifiedYahooEntries.size >= 64) verifiedYahooEntries.clear();
        verifiedYahooEntries.add(verificationKey(latest.entry));
      }
      setState({
        key,
        loading: false,
        entry: !blocked && latest.status === "hit" ? latest.entry : undefined,
        freshness: latest.status === "hit" ? latest.freshness : undefined,
        holdingSafe: !blocked && (request.provider !== "yahoo" || (latest.status === "hit" && verifiedYahooEntries.has(verificationKey(latest.entry)))),
        message: result.status === "refreshed" ? undefined : failure ??
          (result.status === "failed" && result.reason === "timeout"
            ? "History refresh timed out. Cached observations remain available."
            : "History could not be refreshed. Cached observations remain available."),
      });
    }).catch(() => {
      if (active) setState({ ...initial, loading: false, message: "History is unavailable. Please retry." });
    });
    return () => { active = false; };
    // The serialized provider/range identity owns results, not a recreated asset object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, suppliedCache]);

  return { ...(state.key === key ? state : { key, loading: true }), supported: request !== null, retry: () => setRevision((value) => value + 1) };
}
