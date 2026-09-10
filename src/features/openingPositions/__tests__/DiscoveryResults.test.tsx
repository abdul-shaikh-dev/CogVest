import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";

import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { Asset } from "@/src/types";

import { DiscoveryResults } from "../DiscoveryResults";

function providerResult(index: number): AssetLookupResult {
  return {
    assetClass: "stock",
    currency: "INR",
    exchange: "NSE",
    id: `provider-${index}`,
    instrumentType: "stock",
    instrumentTypeConfidence: "inferred",
    metadataReviewMessage: "Review details.",
    name: `Provider ${index}`,
    provider: "yahoo",
    quoteSourceId: `PROVIDER${index}.NS`,
    sectorType: "other",
    sectorTypeConfidence: "reviewRequired",
    sourceLabel: "Yahoo Finance",
    symbol: `PROVIDER${index}`,
    ticker: `PROVIDER${index}.NS`,
  };
}

function savedAsset(index: number): Asset {
  return {
    assetClass: "stock",
    currency: "INR",
    exchange: "NSE",
    id: `saved-${index}`,
    name: `Saved ${index}`,
    quoteSourceId: `SAVED${index}.NS`,
    symbol: `SAVED${index}`,
    ticker: `SAVED${index}.NS`,
  };
}

describe("DiscoveryResults", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("initially mounts five provider rows then settles the first 20", () => {
    const onSettled = jest.fn();
    const { getAllByText } = render(
      <DiscoveryResults
        kind="provider"
        items={Array.from({ length: 20 }, (_, index) => providerResult(index))}
        onSelect={jest.fn()}
        onSettled={onSettled}
      />,
    );

    expect(getAllByText("Select")).toHaveLength(5);

    act(() => jest.runAllTimers());

    expect(getAllByText("Select")).toHaveLength(20);
    expect(onSettled).toHaveBeenLastCalledWith(20);
  });

  it("eventually renders every requested provider row", () => {
    const { getAllByText } = render(
      <DiscoveryResults
        kind="provider"
        items={Array.from({ length: 37 }, (_, index) => providerResult(index))}
        onSelect={jest.fn()}
      />,
    );

    act(() => jest.runAllTimers());

    expect(getAllByText("Select")).toHaveLength(37);
  });

  it("shows the footer only after the current items have fully rendered", () => {
    const { getByTestId, queryByTestId } = render(
      <DiscoveryResults
        footer={<Text testID="discovery-footer">Load more</Text>}
        kind="provider"
        items={Array.from({ length: 20 }, (_, index) => providerResult(index))}
        onSelect={jest.fn()}
      />,
    );

    expect(queryByTestId("discovery-footer")).toBeNull();
    act(() => jest.runAllTimers());
    expect(getByTestId("discovery-footer")).toBeTruthy();
  });

  it("retains mounted rows and appends five rows per commit", () => {
    const initial = Array.from({ length: 20 }, (_, index) => providerResult(index));
    const { getAllByText, getByTestId, rerender } = render(
      <DiscoveryResults kind="provider" items={initial} onSelect={jest.fn()} />,
    );
    act(() => jest.runAllTimers());

    rerender(
      <DiscoveryResults
        kind="provider"
        items={Array.from({ length: 30 }, (_, index) => providerResult(index))}
        onSelect={jest.fn()}
      />,
    );

    expect(getByTestId("asset-lookup-result-provider-0")).toBeTruthy();
    expect(getAllByText("Select")).toHaveLength(20);
    act(() => jest.advanceTimersByTime(16));
    expect(getAllByText("Select")).toHaveLength(25);
  });

  it("retains every mounted row when a new array has the same item IDs", () => {
    const initial = Array.from({ length: 20 }, (_, index) => providerResult(index));
    const { getAllByText, rerender } = render(
      <DiscoveryResults kind="provider" items={initial} onSelect={jest.fn()} />,
    );
    act(() => jest.runAllTimers());

    rerender(
      <DiscoveryResults
        kind="provider"
        items={initial.map((result) => ({ ...result }))}
        onSelect={jest.fn()}
      />,
    );

    expect(getAllByText("Select")).toHaveLength(20);
  });

  it("replaces a changed query with its new five-row prefix immediately", () => {
    const { getAllByText, queryByTestId, rerender } = render(
      <DiscoveryResults
        kind="saved"
        items={Array.from({ length: 20 }, (_, index) => savedAsset(index))}
        onSelect={jest.fn()}
      />,
    );
    act(() => jest.runAllTimers());

    rerender(
      <DiscoveryResults
        kind="saved"
        items={Array.from({ length: 20 }, (_, index) => ({
          ...savedAsset(index),
          id: `replacement-${index}`,
        }))}
        onSelect={jest.fn()}
      />,
    );

    expect(queryByTestId("existing-asset-saved-0")).toBeNull();
    expect(getAllByText("Use")).toHaveLength(5);
  });

  it("cancels pending batches on unmount", () => {
    const onSettled = jest.fn();
    const { unmount } = render(
      <DiscoveryResults
        kind="provider"
        items={Array.from({ length: 20 }, (_, index) => providerResult(index))}
        onSelect={jest.fn()}
        onSettled={onSettled}
      />,
    );

    unmount();
    act(() => jest.runAllTimers());

    expect(onSettled).not.toHaveBeenCalled();
  });
});
