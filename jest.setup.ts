import "@testing-library/jest-native/extend-expect";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, { accessibilityElementsHidden: true }, name),
  };
});

jest.mock("react-native-gifted-charts", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    LineChart: () => React.createElement(View, { testID: "gifted-line-chart" }),
  };
});
