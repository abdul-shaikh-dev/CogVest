import type { ReactElement, ReactNode, Ref } from "react";
import {
  FlatList,
  type ListRenderItem,
  type RefreshControlProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createThemedStyles, spacing } from "@/src/theme";

type ScreenListProps<Item> = {
  /** Overlays such as modals, rendered beside the list. */
  children?: ReactNode;
  data: readonly Item[];
  /** Shown instead of the rows when `data` is empty. */
  empty?: ReactElement;
  footer?: ReactElement;
  header?: ReactElement;
  /** Space between rows. */
  itemGap?: number;
  keyExtractor: (item: Item) => string;
  listRef?: Ref<FlatList<Item>>;
  listStyle?: StyleProp<ViewStyle>;
  listTestID?: string;
  refreshControl?: ReactElement<RefreshControlProps>;
  renderItem: ListRenderItem<Item>;
  testID?: string;
};

/**
 * A screen whose long list is virtualised (#664): only rows near the
 * viewport are mounted. It lays out like a scrolling `ScreenContainer`, with
 * the content above and below the rows as the list's header and footer.
 */
export function ScreenList<Item>({
  children,
  data,
  empty,
  footer,
  header,
  itemGap = 0,
  keyExtractor,
  listRef,
  listStyle,
  listTestID,
  refreshControl,
  renderItem,
  testID,
}: ScreenListProps<Item>) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <FlatList
        ItemSeparatorComponent={itemGap ? () => <View style={{ height: itemGap }} /> : undefined}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, listStyle]}
        data={data}
        initialNumToRender={12}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="always"
        maxToRenderPerBatch={12}
        ref={listRef}
        refreshControl={refreshControl}
        renderItem={renderItem}
        style={styles.list}
        testID={listTestID}
        windowSize={7}
      />
      {children}
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.screenHorizontal,
  },
  list: {
    flex: 1,
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
}));
