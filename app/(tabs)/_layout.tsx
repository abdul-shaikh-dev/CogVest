import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { AppText, getAdaptiveLayoutMode } from "@/src/components/common";
import { colors } from "@/src/theme";

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcons: Record<string, TabIconName> = {
  dashboard: "home-outline",
  holdings: "pie-chart-outline",
  progress: "analytics-outline",
  cash: "wallet-outline",
  settings: "settings-outline",
};

const tabLabels: Record<string, string> = {
  cash: "Cash",
  dashboard: "Dashboard",
  holdings: "Holdings",
  progress: "Progress",
  settings: "Settings",
};

function TabIcon({
  routeName,
  color,
  size,
}: {
  routeName: string;
  color: string;
  size: number;
}) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Ionicons
        accessible={false}
        name={tabIcons[routeName] ?? "ellipse-outline"}
        color={color}
        size={size}
      />
    </View>
  );
}

function TabLabel({ color, routeName }: { color: string; routeName: string }) {
  return (
    <AppText
      maxFontSizeMultiplier={1.5}
      numberOfLines={1}
      style={[styles.tabLabel, { color }]}
    >
      {tabLabels[routeName] ?? routeName}
    </AppText>
  );
}

export default function TabLayout() {
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout =
    getAdaptiveLayoutMode(fontScale) === "accessibility";

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarLabel: ({ color }) => (
          <TabLabel color={color} routeName={route.name} />
        ),
        tabBarStyle: [
          styles.tabBar,
          accessibilityLayout && styles.tabBarAccessibility,
        ],
        tabBarIcon: ({ color, size }) => (
          <TabIcon routeName={route.name} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarAccessibilityLabel: "Dashboard",
          tabBarButtonTestID: "tab-dashboard",
          title: "Dashboard",
        }}
      />
      <Tabs.Screen
        name="holdings"
        options={{
          tabBarAccessibilityLabel: "Holdings",
          tabBarButtonTestID: "tab-holdings",
          title: "Holdings",
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarAccessibilityLabel: "Progress",
          tabBarButtonTestID: "tab-progress",
          title: "Progress",
        }}
      />
      <Tabs.Screen
        name="cash"
        options={{
          tabBarAccessibilityLabel: "Cash",
          tabBarButtonTestID: "tab-cash",
          title: "Cash",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarAccessibilityLabel: "Settings",
          tabBarButtonTestID: "tab-settings",
          title: "Settings",
        }}
      />
      <Tabs.Screen
        name="add-trade"
        options={{ href: null, title: "Add Holding" }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface.card,
    borderTopColor: colors.border.subtle,
    height: 78,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabBarAccessibility: {
    height: 92,
    paddingBottom: 14,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
});
