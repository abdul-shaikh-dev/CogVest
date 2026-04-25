import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

const TAB_BAR_BACKGROUND = "#1C1B1F";
const ACTIVE_TINT = "#2E7D52";
const INACTIVE_TINT = "#CAC4D0";

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcons: Record<string, TabIconName> = {
  dashboard: "grid-outline",
  holdings: "wallet-outline",
  "add-trade": "add",
  history: "time-outline",
  cash: "cash-outline",
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
  if (routeName === "add-trade") {
    return (
      <View style={styles.fab}>
        <Ionicons name="add" color="#E6E1E5" size={size + 4} />
      </View>
    );
  }

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
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }) => (
          <TabIcon routeName={route.name} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="holdings" options={{ title: "Holdings" }} />
      <Tabs.Screen name="add-trade" options={{ title: "Add" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="cash" options={{ title: "Cash" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: "center",
    backgroundColor: ACTIVE_TINT,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: 20,
    width: 56,
  },
  tabBar: {
    backgroundColor: TAB_BAR_BACKGROUND,
    borderTopColor: "#2A2A2A",
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
  },
});
