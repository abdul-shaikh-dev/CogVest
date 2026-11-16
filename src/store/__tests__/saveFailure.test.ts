import { createMemoryJsonStorage, createMmkvJsonStorage, StorageWriteError } from "@/src/services/storage";
import { createPortfolioStore, describeSaveFailure, StoreWriteBlockedError, storageFullMessage } from "@/src/store";
import type { Asset } from "@/src/types";

const asset: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "alpha",
  name: "Synthetic Alpha", symbol: "ALPHA", ticker: "ALPHA.NS",
};

describe("save failure messages (#666)", () => {
  it("blames storage only when the native write failed", () => {
    const failing = createMmkvJsonStorage({
      getString: () => undefined,
      remove: () => { throw new Error("ENOSPC"); },
      set: () => { throw new Error("ENOSPC"); },
    } as never);

    let caught: unknown;
    try { failing.setItem("key", { a: 1 }); } catch (error) { caught = error; }

    expect(caught).toBeInstanceOf(StorageWriteError);
    expect((caught as Error).cause).toEqual(new Error("ENOSPC"));
    expect(() => failing.removeItem("key")).toThrow(StorageWriteError);
    expect(describeSaveFailure(caught, "Fallback.")).toBe(storageFullMessage);
  });

  it("shows the store's own instruction when a restore blocked the write", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { addAsset } = store.getState();
    store.setState({ restoreEpoch: store.getState().restoreEpoch + 1 });

    let caught: unknown;
    try { addAsset(asset); } catch (error) { caught = error; }

    expect(caught).toBeInstanceOf(StoreWriteBlockedError);
    expect(describeSaveFailure(caught, "Fallback.")).toBe("The portfolio was restored. Reopen this screen before saving.");
  });

  it("keeps the screen's message for a rejected record, without blaming storage", () => {
    expect(describeSaveFailure(new Error("Cash entry amount is below supported precision."), "Review it and try again."))
      .toBe("Review it and try again.");
    expect(describeSaveFailure("not an error", "Review it and try again.")).toBe("Review it and try again.");
  });
});
