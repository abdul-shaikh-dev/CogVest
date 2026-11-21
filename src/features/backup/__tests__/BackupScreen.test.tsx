import type { ComponentProps } from "react";
import * as ReactNative from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { usePreventRemove } from "expo-router/react-navigation";

jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));

import {
  BackupScreen,
  formatBackupCreatedAt,
  type PreparedRestore,
} from "@/src/features/backup/BackupScreen";

const prepared: PreparedRestore = {
  review: {
    appVersion: "1.0.1",
    counts: [
      { backup: 3, current: 1, label: "Holdings" },
      { backup: 7, current: 4, label: "Transactions" },
    ],
    createdAt: "2026-09-10T10:30:00.000Z",
  },
};

async function renderScreen(overrides: Partial<ComponentProps<typeof BackupScreen>> = {}) {
  return await render(
    <BackupScreen
      exportPortfolioBackup={async () => "cogvest-backup.json"}
      initialMode="restore"
      onBack={jest.fn()}
      onRestored={jest.fn()}
      restorePortfolioBackup={async () => undefined}
      selectPortfolioBackup={async () => prepared}
      unlockPortfolioBackup={async () => prepared}
      {...overrides}
    />,
  );
}

describe("BackupScreen", () => {
  it("labels both counts at larger text sizes, including zeros and long record names", async () => {
    const dimensions = jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({ fontScale: 1.3, height: 800, scale: 3, width: 360 });
    try {
      const view = await renderScreen({ selectPortfolioBackup: async () => ({ review: {
        ...prepared.review,
        counts: [{ label: "Long synthetic record category", current: 0, backup: 123456 }],
      } }) });
      await fireEvent.press(view.getByTestId("choose-backup-file"));
      await waitFor(() => expect(view.getByTestId("backup-restore-preview")).toBeTruthy());
      expect(view.queryByTestId("backup-count-headings")).toBeNull();
      expect(view.getByText("This device")).toBeTruthy();
      expect(view.getByText("Backup")).toBeTruthy();
      expect(view.getByTestId("backup-count-current-Long synthetic record category")).toHaveTextContent("0");
      expect(view.getByTestId("backup-count-file-Long synthetic record category")).toHaveTextContent("123456");
      expect(view.getByLabelText("Long synthetic record category. This device: 0. Backup: 123456.")).toBeTruthy();
      await view.unmount();
    } finally {
      dimensions.mockRestore();
    }
  });

  it("returns header and intercepted navigation Back to the populated review", async () => {
    const onBack = jest.fn();
    const view = await renderScreen({ onBack });
    await fireEvent.press(view.getByTestId("choose-backup-file"));
    await waitFor(() => expect(view.getByTestId("backup-restore-preview")).toBeTruthy());
    await fireEvent.press(view.getByTestId("continue-restore-confirmation"));
    await fireEvent.press(view.getByTestId("backup-back"));
    expect(view.getByLabelText("Holdings. This device: 1. Backup: 3.")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId("continue-restore-confirmation"));
    const [blocked, back] = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
    expect(blocked).toBe(true);
    await act(() => back!({ data: { action: { type: "GO_BACK" } }, repeat: jest.fn() }));
    expect(view.getByTestId("backup-restore-preview")).toBeTruthy();
    await fireEvent.press(view.getByTestId("backup-back"));
    expect(view.getByTestId("backup-restore-warning")).toBeTruthy();
    await fireEvent.press(view.getByTestId("backup-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("blocks Back during export and announces a readable failure", async () => {
    let reject!: (error: Error) => void;
    const onBack = jest.fn();
    const view = await renderScreen({ initialMode: "export", onBack,
      exportPortfolioBackup: () => new Promise((_, fail) => { reject = fail; }),
    });
    await fireEvent.press(view.getByTestId("choose-backup-location"));
    expect(view.getByTestId("backup-back").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId("backup-back"));
    const [blocked, back] = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
    expect(blocked).toBe(true);
    await act(() => back!({ data: { action: { type: "GO_BACK" } }, repeat: jest.fn() }));
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => reject(new Error("Could not save backup.")));
    expect(view.getByText("Could not save backup.").props.accessibilityLiveRegion).toBe("polite");
    expect(view.getByTestId("backup-back").props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(view.getByTestId("backup-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("warns before export and treats a cancelled location picker as neutral", async () => {
    const exportPortfolioBackup = jest.fn(async () => undefined);
    const { getByTestId, getByText, queryByTestId } = await renderScreen({
      exportPortfolioBackup,
      initialMode: "export",
    });

    expect(getByText("This backup contains sensitive financial information and is not encrypted.")).toBeTruthy();
    await fireEvent.press(getByTestId("choose-backup-location"));
    await waitFor(() => expect(exportPortfolioBackup).toHaveBeenCalledTimes(1));
    expect(queryByTestId("backup-status")).toBeNull();
  });

  it("keeps replacement busy until completion and does not repeat the operation", async () => {
    let finish!: () => void;
    const onBack = jest.fn();
    const restorePortfolioBackup = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const onRestored = jest.fn();
    const view = await renderScreen({ onBack, onRestored, restorePortfolioBackup });
    await fireEvent.press(view.getByTestId("choose-backup-file"));
    await waitFor(() => expect(view.getByTestId("backup-restore-preview")).toBeTruthy());
    expect(restorePortfolioBackup).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId("continue-restore-confirmation"));
    await fireEvent.press(view.getByTestId("confirm-restore-replacement"));
    await fireEvent.press(view.getByTestId("confirm-restore-replacement"));
    await fireEvent.press(view.getByText("Back to review"));
    expect(view.getByTestId("backup-back").props.accessibilityState.disabled).toBe(true);
    const [blocked, back] = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
    expect(blocked).toBe(true);
    await act(() => back!({ data: { action: { type: "GO_BACK" } }, repeat: jest.fn() }));
    expect(onBack).not.toHaveBeenCalled();
    expect(restorePortfolioBackup).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it("only previews a selected backup and shows original and backup counts", async () => {
    const restorePortfolioBackup = jest.fn();
    const { getByTestId, getByText } = await renderScreen({ restorePortfolioBackup });

    await fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("backup-restore-preview")).toBeTruthy());
    expect(getByText(`Created ${formatBackupCreatedAt(prepared.review.createdAt)}`)).toBeTruthy();
    expect(getByText("Display preferences in this backup replace the settings on this device. Value masking and screenshot blocking stay as they are on this device.")).toBeTruthy();
    expect(getByText("Saved prices keep their source details. Prices may be out of date.")).toBeTruthy();
    expect(getByText("CogVest version 1.0.1")).toBeTruthy();
    expect(getByTestId("backup-count-current-Holdings")).toHaveTextContent("1");
    expect(getByTestId("backup-count-file-Holdings")).toHaveTextContent("3");
    expect(getByTestId("backup-count-current-Transactions")).toHaveTextContent("4");
    expect(getByTestId("backup-count-file-Transactions")).toHaveTextContent("7");
    expect(getByText("This replaces the portfolio on this device. It does not merge portfolios.")).toBeTruthy();
    expect(restorePortfolioBackup).not.toHaveBeenCalled();
  });

  it("treats a cancelled backup picker as neutral and keeps restore inactive", async () => {
    const restorePortfolioBackup = jest.fn();
    const { getByTestId, queryByTestId } = await renderScreen({
      restorePortfolioBackup,
      selectPortfolioBackup: async () => undefined,
    });

    await fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() =>
      expect(getByTestId("choose-backup-file").props.accessibilityState).toEqual({
        disabled: false,
      }),
    );
    expect(queryByTestId("backup-restore-preview")).toBeNull();
    expect(restorePortfolioBackup).not.toHaveBeenCalled();
  });

  it("requires a separate destructive confirmation and requires a new review after a failed restore", async () => {
    const restorePortfolioBackup = jest.fn(async () => { throw new Error("Your portfolio changed. Select the backup again."); });
    const selectPortfolioBackup = jest.fn(async () => prepared);
    const { getByTestId, getByText, queryByTestId } = await renderScreen({
      restorePortfolioBackup,
      selectPortfolioBackup,
    });

    await fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("continue-restore-confirmation")).toBeTruthy());
    await fireEvent.press(getByTestId("continue-restore-confirmation"));
    await fireEvent.press(getByTestId("confirm-restore-replacement"));
    await waitFor(() => expect(restorePortfolioBackup).toHaveBeenCalledWith(prepared, expect.any(AbortSignal)));
    expect(getByText("Your portfolio changed. Select the backup again. Reopen the backup review or restart CogVest if recovery is required.")).toBeTruthy();
    expect(queryByTestId("backup-restore-preview")).toBeNull();
    expect(queryByTestId("backup-restore-confirmation")).toBeNull();
    await fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(selectPortfolioBackup).toHaveBeenCalledTimes(2));
  });

  it("clears a stale review and reports selection errors without restoring", async () => {
    const selectPortfolioBackup = jest
      .fn()
      .mockResolvedValueOnce(prepared)
      .mockRejectedValueOnce(new Error("bad file"));
    const { getByTestId, getByText, queryByTestId } = await renderScreen({ selectPortfolioBackup });

    await fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("backup-restore-preview")).toBeTruthy());
    await fireEvent.press(getByText("Choose another backup"));
    await fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByText("bad file")).toBeTruthy());
    expect(queryByTestId("backup-restore-preview")).toBeNull();
  });

  it("backs up current data before confirmation and calls onRestored only after a successful replacement", async () => {
    const exportPortfolioBackup = jest.fn(async () => "before-restore.json");
    const onRestored = jest.fn();
    const { getByTestId } = await renderScreen({ exportPortfolioBackup, onRestored });

    await fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("backup-current-data")).toBeTruthy());
    await fireEvent.press(getByTestId("backup-current-data"));
    await waitFor(() => expect(exportPortfolioBackup).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getByTestId("backup-current-data").props.accessibilityState).toEqual({
        disabled: false,
      }),
    );
    await fireEvent.press(getByTestId("continue-restore-confirmation"));
    await waitFor(() => expect(getByTestId("confirm-restore-replacement")).toBeTruthy());
    await fireEvent.press(getByTestId("confirm-restore-replacement"));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
  });

  it("provides accessible Back and does not update or notify after unmount", async () => {
    let finishSelection: ((value: PreparedRestore | undefined) => void) | undefined;
    const onBack = jest.fn();
    const onRestored = jest.fn();
    const screen = await renderScreen({
      onBack,
      onRestored,
      selectPortfolioBackup: () => new Promise((resolve) => { finishSelection = resolve; }),
    });

    await fireEvent.press(screen.getByTestId("backup-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId("choose-backup-file"));
    await screen.unmount();
    finishSelection?.(prepared);
    await Promise.resolve();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it("aborts an in-progress export when the screen unmounts", async () => {
    let finishExport: ((value: string | undefined) => void) | undefined;
    let receivedSignal: AbortSignal | undefined;
    const screen = await renderScreen({
      exportPortfolioBackup: (signal) => {
        receivedSignal = signal;
        return new Promise((resolve) => { finishExport = resolve; });
      },
      initialMode: "export",
    });

    await fireEvent.press(screen.getByTestId("choose-backup-location"));
    await waitFor(() => expect(receivedSignal).toBeDefined());
    await screen.unmount();
    expect(receivedSignal?.aborted).toBe(true);
    finishExport?.("late-backup.json");
    await Promise.resolve();
  });

  it("encrypts with a confirmed passphrase and clears it after saving (#760)", async () => {
    const exportPortfolioBackup = jest.fn(async () => "CogVest-backup-protected.json");
    const view = await renderScreen({ exportPortfolioBackup, initialMode: "export" });
    expect(view.queryByTestId("backup-passphrase-fields")).toBeNull();
    await fireEvent.press(view.getByTestId("backup-protect"));
    expect(view.getByText("This backup contains sensitive financial information. It will be encrypted with your passphrase.")).toBeTruthy();

    await fireEvent.changeText(view.getByTestId("backup-passphrase"), "short");
    await fireEvent.press(view.getByTestId("choose-backup-location"));
    expect(view.getByText("Use at least 8 characters.")).toBeTruthy();
    await fireEvent.changeText(view.getByTestId("backup-passphrase"), "orbit lantern basil");
    await fireEvent.changeText(view.getByTestId("backup-passphrase-confirm"), "orbit lantern basin");
    await fireEvent.press(view.getByTestId("choose-backup-location"));
    expect(view.getByText("The passphrases do not match.")).toBeTruthy();
    expect(exportPortfolioBackup).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByTestId("backup-passphrase-confirm"), "orbit lantern basil");
    await fireEvent.press(view.getByTestId("choose-backup-location"));
    await waitFor(() => expect(view.getByTestId("backup-status")).toHaveTextContent(
      "CogVest-backup-protected.json saved. It opens only with its passphrase; CogVest does not keep a copy."));
    expect(exportPortfolioBackup).toHaveBeenCalledWith(expect.anything(), { passphrase: "orbit lantern basil" });
    expect(view.getByTestId("backup-passphrase").props.value).toBe("");
    expect(view.getByTestId("backup-passphrase-confirm").props.value).toBe("");
  });

  it("saves an ordinary backup when protection is off", async () => {
    const exportPortfolioBackup = jest.fn(async () => "plain.json");
    const view = await renderScreen({ exportPortfolioBackup, initialMode: "export" });
    await fireEvent.press(view.getByTestId("choose-backup-location"));
    await waitFor(() => expect(exportPortfolioBackup).toHaveBeenCalledWith(expect.anything(), undefined));
  });

  it("asks for a protected backup's passphrase and retries a wrong one (#760)", async () => {
    const unlockPortfolioBackup = jest.fn()
      .mockRejectedValueOnce(new Error("The passphrase is wrong, or the file has been changed. Your portfolio has not changed."))
      .mockResolvedValueOnce(prepared);
    const view = await renderScreen({ selectPortfolioBackup: async () => ({ locked: true }), unlockPortfolioBackup });
    await fireEvent.press(view.getByTestId("choose-backup-file"));
    await waitFor(() => expect(view.getByTestId("backup-restore-unlock")).toBeTruthy());
    expect(view.getByTestId("backup-unlock").props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(view.getByTestId("backup-unlock-passphrase"), "wrong words here");
    await fireEvent.press(view.getByTestId("backup-unlock"));
    await waitFor(() => expect(view.getByTestId("backup-status")).toHaveTextContent(
      "The passphrase is wrong, or the file has been changed. Your portfolio has not changed."));
    expect(view.getByTestId("backup-restore-unlock")).toBeTruthy();

    await fireEvent.changeText(view.getByTestId("backup-unlock-passphrase"), "orbit lantern basil");
    await fireEvent.press(view.getByTestId("backup-unlock"));
    await waitFor(() => expect(view.getByTestId("backup-restore-preview")).toBeTruthy());
    expect(unlockPortfolioBackup).toHaveBeenLastCalledWith({ locked: true }, "orbit lantern basil", expect.anything());
    expect(view.queryByTestId("backup-restore-unlock")).toBeNull();
  });

  it("returns to choosing a file when a protected backup cannot be read", async () => {
    const unlockPortfolioBackup = jest.fn(async () => {
      throw new Error("This backup could not be read or validated. Choose an intact, supported CogVest backup. Your portfolio has not changed.");
    });
    const view = await renderScreen({ selectPortfolioBackup: async () => ({ locked: true }), unlockPortfolioBackup });
    await fireEvent.press(view.getByTestId("choose-backup-file"));
    await waitFor(() => expect(view.getByTestId("backup-restore-unlock")).toBeTruthy());
    await fireEvent.changeText(view.getByTestId("backup-unlock-passphrase"), "orbit lantern basil");
    await fireEvent.press(view.getByTestId("backup-unlock"));
    await waitFor(() => expect(view.getByTestId("backup-restore-warning")).toBeTruthy());
    expect(view.queryByTestId("backup-restore-unlock")).toBeNull();
  });

  it("goes back from the passphrase step to choosing a file", async () => {
    const onBack = jest.fn();
    const view = await renderScreen({ onBack, selectPortfolioBackup: async () => ({ locked: true }) });
    await fireEvent.press(view.getByTestId("choose-backup-file"));
    await waitFor(() => expect(view.getByTestId("backup-restore-unlock")).toBeTruthy());
    await fireEvent.press(view.getByTestId("backup-back"));
    expect(view.getByTestId("backup-restore-warning")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });
});
