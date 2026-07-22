import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateHoldings,
  calculateSellRedeemPreview,
  validateSellRedeemFees,
  type SellRedeemPreview,
} from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  isFutureDate,
  isValidDateString,
  validateSellQuantity,
} from "@/src/domain/validators";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { CashEntry, Holding, Trade } from "@/src/types";
import { createId } from "@/src/utils";

type UseSellRedeemHoldingInput = {
  assetId: string;
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
};

type FieldErrors = Partial<
  Record<"date" | "fees" | "quantity" | "save" | "sellPrice", string>
>;

type SaveResult =
  | { cashEntry?: CashEntry; isValid: true; trade: Trade }
  | { errors: FieldErrors; isValid: false };

export type UseSellRedeemHoldingResult = {
  availableUnits: number;
  canSave: boolean;
  date: string;
  errors: FieldErrors;
  fees: string;
  holding: Holding | null;
  isSaving: boolean;
  notes: string;
  preview: SellRedeemPreview | null;
  quantity: string;
  save: () => SaveResult;
  sellPrice: string;
  setDate: (value: string) => void;
  setFees: (value: string) => void;
  setNotes: (value: string) => void;
  setQuantity: (value: string) => void;
  setSellPrice: (value: string) => void;
  status: "not-found" | "ready";
  successMessage: string;
};

function parseNumber(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? Number(trimmed) : Number.NaN;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? Number(trimmed) : 0;
}

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useSellRedeemHolding({
  assetId,
  now = new Date(),
  store = getPortfolioStore(),
}: UseSellRedeemHoldingInput): UseSellRedeemHoldingResult {
  const snapshot = usePortfolioSnapshot(store);
  const [quantity, setQuantity] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(formatLocalCalendarDate(now));
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const savedResultRef = useRef<SaveResult | null>(null);
  const tradeIdRef = useRef(createId("trade"));

  const holdings = useMemo(
    () =>
      calculateHoldings({
        assets: snapshot.assets,
        openingPositions: snapshot.openingPositions,
        quoteCache: snapshot.quoteCache,
        trades: snapshot.trades,
        now,
      }),
    [snapshot.assets, snapshot.openingPositions, snapshot.quoteCache, snapshot.trades],
  );
  const holding = holdings.find((candidate) => candidate.asset.id === assetId) ?? null;
  const availableUnits = holding?.totalUnits ?? 0;
  const quantityValue = parseNumber(quantity);
  const sellPriceValue = parseNumber(sellPrice);
  const feeValue = parseOptionalNumber(fees);
  const quantityValidationMessage = useMemo(() => {
    if (!holding || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      return undefined;
    }

    const assetTrades = snapshot.trades.filter((trade) => trade.assetId === assetId);
    const assetOpeningPositions = snapshot.openingPositions.filter(
      (position) => position.assetId === assetId,
    );
    const sellQuantityResult = validateSellQuantity(
      assetTrades,
      quantityValue,
      assetOpeningPositions,
      now,
    );

    return sellQuantityResult.isValid ? undefined : sellQuantityResult.message;
  }, [
    assetId,
    holding,
    quantityValue,
    snapshot.openingPositions,
    snapshot.trades,
    now,
  ]);
  const preview =
    holding &&
    Number.isFinite(quantityValue) &&
    Number.isFinite(sellPriceValue) &&
    !quantityValidationMessage
      ? calculateSellRedeemPreview({
          availableUnits,
          currentPrice: holding.currentPrice,
          fees: Number.isFinite(feeValue) ? feeValue : 0,
          quantity: quantityValue,
          sellPrice: sellPriceValue,
        })
      : null;

  useEffect(() => {
    if (holding && sellPrice.trim().length === 0 && holding.currentPrice > 0) {
      setSellPrice(String(holding.currentPrice));
    }
  }, [holding, sellPrice]);

  function validate() {
    const nextErrors: FieldErrors = {};

    if (!holding) {
      nextErrors.quantity = "Holding was not found.";
      return nextErrors;
    }

    if (!Number.isFinite(quantityValue)) {
      nextErrors.quantity = "Quantity must be a valid number.";
    } else if (quantityValue <= 0) {
      nextErrors.quantity = "Quantity must be greater than zero.";
    } else if (quantityValidationMessage) {
      nextErrors.quantity = quantityValidationMessage;
    }

    if (!Number.isFinite(sellPriceValue)) {
      nextErrors.sellPrice = "Sell price must be a valid number.";
    } else if (sellPriceValue <= 0) {
      nextErrors.sellPrice = "Sell price must be greater than zero.";
    }

    if (!Number.isFinite(feeValue)) {
      nextErrors.fees = "Fees must be a valid number.";
    } else if (feeValue < 0) {
      nextErrors.fees = "Fees must be zero or greater.";
    }

    if (date.trim().length === 0) {
      nextErrors.date = "Date is required.";
    } else if (!isValidDateString(date)) {
      nextErrors.date = "Date must be valid.";
    } else if (isFutureDate(date, now)) {
      nextErrors.date = "Date cannot be in the future.";
    }

    if (preview) {
      const feeResult = validateSellRedeemFees({
        fees: feeValue,
        grossProceeds: preview.grossProceeds,
      });

      if (!feeResult.isValid) {
        nextErrors.fees = feeResult.message;
      }
    }

    return nextErrors;
  }

  const displayErrors = {
    ...errors,
    quantity: errors.quantity ?? quantityValidationMessage,
  };
  const canSave =
    Boolean(preview) &&
    Object.keys(validate()).length === 0 &&
    !isSaving &&
    !successMessage;

  function save(): SaveResult {
    if (savedResultRef.current) {
      return savedResultRef.current;
    }

    if (isSavingRef.current) {
      return {
        errors: { save: "This sale is already being saved." },
        isValid: false,
      };
    }

    setSuccessMessage("");
    const nextErrors = validate();

    if (!holding || !preview || Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return {
        errors: nextErrors,
        isValid: false,
      };
    }

    const trimmedNotes = notes.trim();
    const trade: Trade = {
      assetId,
      date: date.trim(),
      fees: feeValue || undefined,
      id: tradeIdRef.current,
      notes: trimmedNotes || undefined,
      pricePerUnit: sellPriceValue,
      quantity: quantityValue,
      totalValue: preview.netProceeds,
      type: "sell",
    };
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const result = store.getState().recordSaleWithProceeds({
        cashLabel: `${holding.asset.name} sale proceeds`,
        cashNotes:
          trimmedNotes || `Linked to ${holding.asset.name} sell / redeem`,
        trade,
      });

      if (!result.isValid) {
        const saveErrors = {
          save: "This sale could not be saved safely. Review it and try again.",
        };
        setErrors(saveErrors);
        return { errors: saveErrors, isValid: false };
      }

      const saveResult: SaveResult = {
        cashEntry: result.cashEntry,
        isValid: true,
        trade,
      };

      savedResultRef.current = saveResult;
      setErrors({});
      setSuccessMessage("Sell / redeem recorded.");

      return saveResult;
    } catch {
      const saveErrors = {
        save: "This sale could not be saved safely. Review it and try again.",
      };
      setErrors(saveErrors);
      return { errors: saveErrors, isValid: false };
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return {
    availableUnits,
    canSave,
    date,
    errors: displayErrors,
    fees,
    holding,
    isSaving,
    notes,
    preview,
    quantity,
    save,
    sellPrice,
    setDate,
    setFees,
    setNotes,
    setQuantity,
    setSellPrice,
    status: holding ? "ready" : "not-found",
    successMessage,
  };
}
