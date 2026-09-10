import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  memo,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";

import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { Asset } from "@/src/types";
import { spacing } from "@/src/theme";

import { DiscoveryResultRow, SavedAssetRow } from "./DiscoveryResultRow";

const initialBatchSize = 5;
const batchSize = 5;
const batchDelayMs = 16;

type ProviderDiscoveryResultsProps = {
  footer?: ReactNode;
  kind: "provider";
  items: AssetLookupResult[];
  onSelect: (result: AssetLookupResult) => void;
  onSettled?: (count: number) => void;
};

type SavedDiscoveryResultsProps = {
  footer?: ReactNode;
  kind: "saved";
  items: Asset[];
  onSelect: (asset: Asset) => void;
  onSettled?: (count: number) => void;
};

export type DiscoveryResultsProps =
  | ProviderDiscoveryResultsProps
  | SavedDiscoveryResultsProps;

type RenderState = {
  count: number;
  itemIds: string[];
  items: Array<Asset | AssetLookupResult> | undefined;
};

function hasSameItemIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function hasItemIdPrefix(prefix: string[], values: string[]) {
  return prefix.length > 0 &&
    prefix.length < values.length &&
    prefix.every((id, index) => id === values[index]);
}

export const DiscoveryResults = memo(function DiscoveryResults(
  props: DiscoveryResultsProps,
) {
  const items: Array<Asset | AssetLookupResult> =
    props.items;
  const itemIds = items.map((item) => item.id);
  const [renderState, setRenderState] = useState<RenderState>({
    count: 0,
    itemIds: [],
    items: undefined,
  });
  const settledItemsRef = useRef<Array<Asset | AssetLookupResult> | undefined>(
    undefined,
  );
  const onSettledRef = useRef(props.onSettled);

  onSettledRef.current = props.onSettled;

  const itemsChanged = renderState.items !== items;
  const retainsVisibleRows =
    itemsChanged &&
    (hasSameItemIds(renderState.itemIds, itemIds) ||
      hasItemIdPrefix(renderState.itemIds, itemIds));
  const visibleCount =
    itemsChanged && !retainsVisibleRows
      ? Math.min(initialBatchSize, items.length)
      : Math.min(renderState.count, items.length);
  const isFullyRendered = !itemsChanged && renderState.count >= items.length;

  useEffect(() => {
    const retainsCurrentRows =
      renderState.items !== undefined &&
      (hasSameItemIds(renderState.itemIds, itemIds) ||
        hasItemIdPrefix(renderState.itemIds, itemIds));
    let nextCount = retainsCurrentRows
      ? Math.min(renderState.count, items.length)
      : Math.min(initialBatchSize, items.length);

    setRenderState({ count: nextCount, itemIds, items });

    if (nextCount >= items.length) return undefined;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const appendBatch = () => {
      nextCount = Math.min(nextCount + batchSize, items.length);
      setRenderState((current) =>
        current.items === items
          ? { ...current, count: nextCount }
          : current,
      );

      if (nextCount < items.length) {
        timer = setTimeout(appendBatch, batchDelayMs);
      }
    };

    timer = setTimeout(appendBatch, batchDelayMs);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [items]);

  useLayoutEffect(() => {
    if (isFullyRendered && settledItemsRef.current !== items) {
      settledItemsRef.current = items;
      onSettledRef.current?.(items.length);
    }
  }, [isFullyRendered, items, items.length]);

  return (
    <View style={styles.results}>
      {items.slice(0, visibleCount).map((item) =>
        props.kind === "provider" ? (
          <DiscoveryResultRow
            key={item.id}
            onSelect={props.onSelect}
            result={item as AssetLookupResult}
          />
        ) : (
          <SavedAssetRow
            asset={item as Asset}
            key={item.id}
            onSelect={props.onSelect}
          />
        ),
      )}
      {isFullyRendered ? props.footer : null}
    </View>
  );
});

const styles = StyleSheet.create({
  results: { gap: spacing.xs },
});
