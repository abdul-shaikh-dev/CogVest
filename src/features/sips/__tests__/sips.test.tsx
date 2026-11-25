import { act, fireEvent, render } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

import { SipConfirmScreen } from "../SipConfirmScreen";
import { SipDueCard } from "../SipDueCard";
import { SipDueScreen } from "../SipDueScreen";
import { SipTemplateScreen } from "../SipTemplateScreen";
import { SipTemplatesScreen } from "../SipTemplatesScreen";
import { buildSipInput, sipDraftFrom, sipPriceWindow, sipScheduleText } from "../sipViewModel";

const mockHistory = { current: { entry: undefined as undefined | { points: { close: number; date: string }[] }, holdingSafe: true, loading: false } };
jest.mock("@/src/features/holdings/useAssetHistory", () => ({
  useAssetHistory: () => ({ ...mockHistory.current, retry: jest.fn(), supported: true }),
}));

const now = new Date("2026-11-24T06:00:00Z");
const fund: Asset = {
  assetClass: "stock", currency: "INR", id: "fund", instrumentType: "mutualFund", isin: "INF000000001",
  name: "Synthetic Index Fund", symbol: "INF000000001", ticker: "INF000000001",
};
const share: Asset = { assetClass: "stock", currency: "INR", exchange: "NSE", id: "share", name: "Synthetic Share", symbol: "SYN", ticker: "SYN.NS" };

function fixture(funding: "cash" | "deposit" = "cash") {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addAsset(fund);
  store.getState().addAsset(share);
  store.getState().addCashEntry({ amount: 20000, date: "2026-01-01", id: "opening", label: "Opening", purpose: "capitalContribution", type: "addition" });
  store.getState().saveSipTemplate({ amountInr: 5000, assetId: "fund", dayOfMonth: 5, funding, id: "sip-1", startMonth: "2026-10" });
  return store;
}

beforeEach(() => {
  mockHistory.current = { entry: undefined, holdingSafe: true, loading: false };
});

describe("SIP view model (#766)", () => {
  it("keeps a month-end day when the first date is unchanged, and takes a new one otherwise", () => {
    const saved = { amountInr: 1000, assetId: "fund", createdAt: "", dayOfMonth: 31, funding: "cash" as const,
      handledMonths: [], id: "s", paused: false, startMonth: "2026-11", updatedAt: "" };
    const draft = sipDraftFrom(saved, "2026-11-24");
    expect(draft.firstDate).toBe("2026-11-30");
    expect(buildSipInput(draft, "s", saved)).toMatchObject({ input: { dayOfMonth: 31, startMonth: "2026-11" }, ok: true });
    expect(buildSipInput({ ...draft, firstDate: "2026-12-10" }, "s", saved)).toMatchObject({ input: { dayOfMonth: 10, startMonth: "2026-12" } });
    expect(buildSipInput({ ...draft, amount: "abc", assetId: "" }, "s")).toEqual({ errors: { amount: expect.any(String), assetId: "Choose a holding." }, ok: false });
  });

  it("describes the schedule and hides the amount when masked", () => {
    expect(sipScheduleText({ amountInr: 5000, dayOfMonth: 5 }, false)).toBe("₹5,000.00 on the 5th of each month");
    expect(sipScheduleText({ amountInr: 5000, dayOfMonth: 31 }, true)).toBe("An amount on the 31st (or the month's last day) of each month");
  });

  it("looks for a price from the due date up to ten days later, never past today", () => {
    expect(sipPriceWindow("2026-11-05", now)).toEqual({ from: "2026-11-05", to: "2026-11-15" });
    expect(sipPriceWindow("2026-11-20", now)).toEqual({ from: "2026-11-20", to: "2026-11-24" });
  });
});

describe("SIP screens (#766)", () => {
  it("lists templates and opens one or a new one", async () => {
    const store = fixture();
    const onOpen = jest.fn();
    const screen = await render(<SipTemplatesScreen onBack={jest.fn()} onOpen={onOpen} store={store} />);

    expect(screen.getByTestId("sips-row-sip-1")).toHaveTextContent(/Synthetic Index Fund/u);
    await fireEvent.press(screen.getByTestId("sips-row-sip-1"));
    expect(onOpen).toHaveBeenCalledWith("sip-1");
    await fireEvent.press(screen.getByTestId("sips-add"));
    expect(onOpen).toHaveBeenLastCalledWith();
  });

  it("creates a template from the form and shows field errors first", async () => {
    const store = fixture();
    const onBack = jest.fn();
    const screen = await render(<SipTemplateScreen now={now} onBack={onBack} store={store} />);

    await fireEvent.press(screen.getByTestId("sip-save"));
    expect(screen.getByText("Choose a holding.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("sip-holding-picker"));
    await fireEvent.press(screen.getByTestId("sip-holding-share"));
    await fireEvent.changeText(screen.getByTestId("sip-amount"), "2500");
    await fireEvent.press(screen.getByTestId("sip-save"));

    expect(onBack).toHaveBeenCalled();
    expect(store.getState().sipTemplates[1]).toMatchObject({ amountInr: 2500, assetId: "share", dayOfMonth: 24, startMonth: "2026-11" });
  });

  it("pauses and deletes a template only after a second tap", async () => {
    const store = fixture();
    const screen = await render(<SipTemplateScreen now={now} onBack={jest.fn()} store={store} templateId="sip-1" />);

    await fireEvent.press(screen.getByTestId("sip-pause"));
    expect(store.getState().sipTemplates[0].paused).toBe(true);
    await fireEvent.press(screen.getByTestId("sip-delete"));
    expect(store.getState().sipTemplates).toHaveLength(1);
    await fireEvent.press(screen.getByTestId("sip-delete"));
    expect(store.getState().sipTemplates).toEqual([]);
  });

  it("shows the Dashboard card only while instalments are due", async () => {
    const store = fixture();
    const onOpen = jest.fn();
    const screen = await render(<SipDueCard now={now} onOpen={onOpen} store={store} />);

    expect(screen.getByTestId("dashboard-sip-due-count")).toHaveTextContent("2 SIP instalments to confirm");
    await fireEvent.press(screen.getByTestId("dashboard-sip-due-open"));
    expect(onOpen).toHaveBeenCalled();
    await act(async () => { store.getState().setSipTemplatePaused("sip-1", true); });
    expect(screen.queryByTestId("dashboard-sip-due")).toBeNull();
  });

  it("skips an instalment without recording anything", async () => {
    const store = fixture();
    const screen = await render(<SipDueScreen now={now} onBack={jest.fn()} onConfirm={jest.fn()} store={store} />);

    await fireEvent.press(screen.getByTestId("sip-due-skip-sip-1-2026-10"));
    expect(screen.getByTestId("sip-due-message")).toHaveTextContent("Skipped. Nothing was recorded.");
    expect(screen.queryByTestId("sip-due-sip-1-2026-10")).toBeNull();
    expect(store.getState().trades).toEqual([]);
  });

  it("prefills the next trading day's NAV and units, then records one purchase", async () => {
    mockHistory.current = { entry: { points: [{ close: 98, date: "2026-11-04" }, { close: 123.4567, date: "2026-11-06" }] }, holdingSafe: true, loading: false };
    const store = fixture();
    store.getState().skipSipInstalment("sip-1", "2026-10");
    const onDone = jest.fn();
    const screen = await render(<SipConfirmScreen month="2026-11" now={now} onBack={jest.fn()} onDone={onDone} store={store} templateId="sip-1" />);

    expect(screen.getByTestId("sip-confirm-price").props.value).toBe("123.4567");
    expect(screen.getByTestId("sip-confirm-units").props.value).toBe("40.5");
    expect(screen.getByTestId("sip-confirm-price-note")).toHaveTextContent(/NAV on .*the next trading day/u);
    await fireEvent.press(screen.getByTestId("sip-confirm-save"));

    expect(onDone).toHaveBeenCalled();
    expect(store.getState().trades).toEqual([expect.objectContaining({ assetId: "fund", date: "2026-11-06", quantity: 40.5 })]);
    expect(store.getState().sipTemplates[0].handledMonths).toContainEqual(expect.objectContaining({ month: "2026-11", status: "confirmed" }));
  });

  it("asks for the price when history has none, and recomputes units from it", async () => {
    const store = fixture();
    const screen = await render(<SipConfirmScreen month="2026-10" now={now} onBack={jest.fn()} onDone={jest.fn()} store={store} templateId="sip-1" />);

    expect(screen.getByTestId("sip-confirm-price-note")).toHaveTextContent("No price found for this date. Enter the price you paid.");
    await fireEvent.changeText(screen.getByTestId("sip-confirm-price"), "250");
    expect(screen.getByTestId("sip-confirm-units").props.value).toBe("20");
  });

  it("says when Cash cannot pay, and records nothing", async () => {
    const store = fixture();
    store.getState().saveSipTemplate({ amountInr: 50000, assetId: "fund", dayOfMonth: 5, funding: "cash", id: "sip-1", startMonth: "2026-10" });
    const screen = await render(<SipConfirmScreen month="2026-10" now={now} onBack={jest.fn()} onDone={jest.fn()} store={store} templateId="sip-1" />);

    await fireEvent.changeText(screen.getByTestId("sip-confirm-price"), "100");
    await fireEvent.press(screen.getByTestId("sip-confirm-save"));
    expect(screen.getByTestId("sip-confirm-error")).toHaveTextContent(/Cash/u);
    expect(store.getState().trades).toEqual([]);
  });

  it("says an instalment is no longer due", async () => {
    const store = fixture();
    const screen = await render(<SipConfirmScreen month="2026-12" now={now} onBack={jest.fn()} onDone={jest.fn()} store={store} templateId="sip-1" />);
    expect(screen.getByTestId("sip-confirm-not-due")).toBeTruthy();
  });
});
