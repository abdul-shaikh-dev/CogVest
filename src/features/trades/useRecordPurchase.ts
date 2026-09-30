import { useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";
import { findCanonicalAsset } from "@/src/domain/assets";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { normalizeTrade } from "@/src/domain/financialRecords";
import { normalizeMoney } from "@/src/domain/precision";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Asset, BuyTrade } from "@/src/types";
import { createId } from "@/src/utils";
import { validateTradeForm } from "./tradeForm";

export function useRecordPurchase({ initialAssetId, now = new Date(), store = getPortfolioStore() }: {
  initialAssetId?: string; now?: Date; store?: StoreApi<PortfolioStoreState>;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [asset, setAsset] = useState<Asset | undefined>(() => snapshot.assets.find((item) => item.id === initialAssetId));
  const [phase, setPhase] = useState<"asset" | "details" | "review">(asset ? "details" : "asset");
  const [values, setValues] = useState({ quantity: "", pricePerUnit: "", fees: "", date: formatLocalCalendarDate(now), notes: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values | "asset" | "save", string>>>({});
  const [review, setReview] = useState<BuyTrade>();
  const [saved, setSaved] = useState(false);

  function selectAsset(candidate: Asset) {
    if (candidate.currency !== "INR" || candidate.instrumentType === "ppf") {
      setErrors({ asset: "Choose an INR investment. PPF uses its own account workflow." });
      return;
    }
    setAsset(findCanonicalAsset(snapshot.assets, candidate) ?? candidate);
    setErrors({});
    setReview(undefined);
    setPhase("details");
  }

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setReview(undefined);
    setErrors({});
  }

  function prepareReview() {
    if (!asset) return;
    const result = validateTradeForm({ ...values, assetId: asset.id, type: "buy" }, snapshot.trades, snapshot.openingPositions, now);
    const fees = values.fees.trim() ? Number(values.fees) : 0;
    if (!result.isValid || !Number.isFinite(fees) || fees < 0) {
      setErrors({ ...(!result.isValid ? result.errors : {}), ...(!Number.isFinite(fees) || fees < 0 ? { fees: "Enter fees of zero or greater." } : {}) });
      return;
    }
    const candidate = normalizeTrade<BuyTrade>({
      date: result.value.date, quantity: result.value.quantity, pricePerUnit: result.value.pricePerUnit,
      type: "buy", id: createId("trade"), assetId: asset.id,
      fees: normalizeMoney(fees) || undefined, notes: values.notes.trim() || undefined, totalValue: 0,
    });
    setReview(candidate);
    setErrors({});
    setPhase("review");
  }

  function save() {
    if (!asset || !review || saved) return false;
    try {
      const result = store.getState().recordFundedBuy({
        asset, trade: review, cashLabel: `${asset.name} purchase`, cashNotes: review.notes,
      });
      if (!result.isValid) {
        setErrors({ save: result.reason === "insufficientCash"
          ? "Not enough Cash for this purchase and its fees. Add dated Cash funding or reduce the amount."
          : "Purchase could not be saved safely. Check the asset, date and Cash funding." });
        return false;
      }
      setSaved(true);
      return true;
    } catch {
      setErrors({ save: "Purchase was not saved. Your records are unchanged. Free device storage and try again." });
      return false;
    }
  }

  return { asset, errors, phase, prepareReview, review, saved, save, selectAsset, setPhase, snapshot, update, values,
    hasDraft: !saved && Boolean(asset || values.quantity || values.pricePerUnit || values.fees || values.notes) };
}
