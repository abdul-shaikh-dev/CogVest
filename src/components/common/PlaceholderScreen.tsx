import { StyleSheet, Text, View } from "react-native";

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#1C1B1F",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  title: {
    color: "#E6E1E5",
    fontSize: 28,
    fontWeight: "700",
  },
});
