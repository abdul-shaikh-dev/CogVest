import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";

import { colors } from "@/src/theme";

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcons: Record<string, TabIconName> = {
  dashboard: "home-outline",
  holdings: "pie-chart-outline",
  progress: "analytics-outline",
  cash: "wallet-outline",
  settings: "settings-outline",
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
    <Ionicons
      name={tabIcons[routeName] ?? "ellipse-outline"}
      color={color}
      size={size}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }) => (
          <TabIcon routeName={route.name} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarButtonTestID: "tab-dashboard", title: "Dashboard" }}
      />
      <Tabs.Screen
        name="holdings"
        options={{ tabBarButtonTestID: "tab-holdings", title: "Holdings" }}
      />
      <Tabs.Screen
        name="progress"
        options={{ tabBarButtonTestID: "tab-progress", title: "Progress" }}
      />
      <Tabs.Screen
        name="cash"
        options={{ tabBarButtonTestID: "tab-cash", title: "Cash" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarButtonTestID: "tab-settings", title: "Settings" }}
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
});
