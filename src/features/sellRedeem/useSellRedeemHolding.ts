import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateHoldings,
  calculateSellRedeemPreview,
  validateSellRedeemFees,
  type SellRedeemPreview,
} from "@/src/domain/calculations";
import { validateSellQuantity } from "@/src/domain/validators";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { CashEntry, Holding, Trade } from "@/src/types";
import { createId } from "@/src/utils";

type UseSellRedeemHoldingInput = {
  assetId: string;
  store?: StoreApi<PortfolioStoreState>;
};

type FieldErrors = Partial<
  Record<"cashAmount" | "cashLabel" | "date" | "fees" | "quantity" | "sellPrice", string>
>;

type SaveResult =
  | { cashEntry?: CashEntry; isValid: true; trade: Trade }
  | { errors: FieldErrors; isValid: false };

export type UseSellRedeemHoldingResult = {
  availableUnits: number;
  canSave: boolean;
  cashAmount: string;
  cashLabel: string;
  date: string;
  errors: FieldErrors;
  fees: string;
  holding: Holding | null;
  linkCashEntry: boolean;
  notes: string;
  preview: SellRedeemPreview | null;
  quantity: string;
  save: () => SaveResult;
  sellPrice: string;
  setCashAmount: (value: string) => void;
  setCashLabel: (value: string) => void;
  setDate: (value: string) => void;
  setFees: (value: string) => void;
  setLinkCashEntry: (value: boolean) => void;
  setNotes: (value: string) => void;
  setQuantity: (value: string) => void;
  setSellPrice: (value: string) => void;
  status: "not-found" | "ready";
  successMessage: string;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

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

function defaultCashLabel(holding: Holding | null) {
  return holding ? `${holding.asset.name} redemption proceeds` : "";
}

export function useSellRedeemHolding({
  assetId,
  store = getPortfolioStore(),
}: UseSellRedeemHoldingInput): UseSellRedeemHoldingResult {
  const snapshot = usePortfolioSnapshot(store);
  const [quantity, setQuantity] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [linkCashEntry, setLinkCashEntry] = useState(true);
  const [cashAmount, setCashAmount] = useState("");
  const [cashAmountWasEdited, setCashAmountWasEdited] = useState(false);
  const [cashLabel, setCashLabel] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState("");

  const holdings = useMemo(
    () =>
      calculateHoldings({
        assets: snapshot.assets,
        openingPositions: snapshot.openingPositions,
        quoteCache: snapshot.quoteCache,
        trades: snapshot.trades,
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
    );

    return sellQuantityResult.isValid ? undefined : sellQuantityResult.message;
  }, [
    assetId,
    holding,
    quantityValue,
    snapshot.openingPositions,
    snapshot.trades,
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

  useEffect(() => {
    if (holding && cashLabel.trim().length === 0) {
      setCashLabel(defaultCashLabel(holding));
    }
  }, [cashLabel, holding]);

  useEffect(() => {
    if (preview && !cashAmountWasEdited) {
      setCashAmount(String(preview.netProceeds));
    }
  }, [cashAmountWasEdited, preview]);

  useEffect(() => {
    if (!preview && !cashAmountWasEdited) {
      setCashAmount("");
    }
  }, [cashAmountWasEdited, preview]);

  function updateCashAmount(value: string) {
    setCashAmountWasEdited(true);
    setCashAmount(value);
  }

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
    } else if (Number.isNaN(new Date(date).getTime())) {
      nextErrors.date = "Date must be valid.";
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

    if (linkCashEntry) {
      const cashAmountValue = parseNumber(cashAmount);

      if (!Number.isFinite(cashAmountValue)) {
        nextErrors.cashAmount = "Cash amount must be a valid number.";
      } else if (cashAmountValue < 0) {
        nextErrors.cashAmount = "Cash amount must be zero or greater.";
      }

      if (cashLabel.trim().length === 0) {
        nextErrors.cashLabel = "Cash label is required.";
      }
    }

    return nextErrors;
  }

  const displayErrors = {
    ...errors,
    quantity: errors.quantity ?? quantityValidationMessage,
  };
  const canSave =
    Boolean(preview) && Object.keys(validate()).length === 0;

  function save(): SaveResult {
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
      id: createId("trade"),
      notes: trimmedNotes || undefined,
      pricePerUnit: sellPriceValue,
      quantity: quantityValue,
      totalValue: preview.netProceeds,
      type: "sell",
    };
    let cashEntry: CashEntry | undefined;

    store.getState().addTrade(trade);

    if (linkCashEntry) {
      cashEntry = {
        amount: parseNumber(cashAmount),
        date: date.trim(),
        id: createId("cash"),
        label: cashLabel.trim(),
        notes: trimmedNotes || `Linked to ${holding.asset.name} sell / redeem`,
        type: "addition",
      };
      store.getState().addCashEntry(cashEntry);
    }

    setErrors({});
    setSuccessMessage("Sell / redeem recorded.");

    return {
      cashEntry,
      isValid: true,
      trade,
    };
  }

  return {
    availableUnits,
    canSave,
    cashAmount,
    cashLabel,
    date,
    errors: displayErrors,
    fees,
    holding,
    linkCashEntry,
    notes,
    preview,
    quantity,
    save,
    sellPrice,
    setCashAmount: updateCashAmount,
    setCashLabel,
    setDate,
    setFees,
    setLinkCashEntry,
    setNotes,
    setQuantity,
    setSellPrice,
    status: holding ? "ready" : "not-found",
    successMessage,
  };
}
