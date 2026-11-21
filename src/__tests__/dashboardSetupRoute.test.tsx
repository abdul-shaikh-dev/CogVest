const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({ router: { navigate: mockNavigate, push: jest.fn() } }));
jest.mock("@/src/features/quickSetup", () => ({
  useQuickSetupSession: () => ({ session: null }),
}));
// The real status store needs native MMKV (#759).
jest.mock("@/src/services/backup/backupStatus", () => ({ getBackupStatusStore: () => undefined }));

const DashboardRoute = require("../../app/(tabs)/dashboard").default;

it("opens the shared Holdings entry chooser from Dashboard setup", () => {
  const element = DashboardRoute();
  element.props.onQuickSetup();
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/holdings", params: { openAddMenu: "true" },
  });
});
