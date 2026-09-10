import type { ComponentProps } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

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

function renderScreen(overrides: Partial<ComponentProps<typeof BackupScreen>> = {}) {
  return render(
    <BackupScreen
      exportPortfolioBackup={async () => "cogvest-backup.json"}
      initialMode="restore"
      onBack={jest.fn()}
      onRestored={jest.fn()}
      restorePortfolioBackup={async () => undefined}
      selectPortfolioBackup={async () => prepared}
      {...overrides}
    />,
  );
}

describe("BackupScreen", () => {
  it("warns before export and treats a cancelled location picker as neutral", async () => {
    const exportPortfolioBackup = jest.fn(async () => undefined);
    const { getByTestId, getByText, queryByTestId } = renderScreen({
      exportPortfolioBackup,
      initialMode: "export",
    });

    expect(getByText("This backup contains sensitive financial information and is not encrypted.")).toBeTruthy();
    fireEvent.press(getByTestId("choose-backup-location"));
    await waitFor(() => expect(exportPortfolioBackup).toHaveBeenCalledTimes(1));
    expect(queryByTestId("backup-status")).toBeNull();
  });

  it("only previews a selected backup and shows original and backup counts", async () => {
    const restorePortfolioBackup = jest.fn();
    const { getByTestId, getByText } = renderScreen({ restorePortfolioBackup });

    fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("backup-restore-preview")).toBeTruthy());
    expect(getByText(`Created ${formatBackupCreatedAt(prepared.review.createdAt)}`)).toBeTruthy();
    expect(getByText("Display mode and value masking preferences in this backup replace the settings on this device.")).toBeTruthy();
    expect(getByText("Saved price source provenance is retained. Prices may not be current.")).toBeTruthy();
    expect(getByText("CogVest version 1.0.1")).toBeTruthy();
    expect(getByText("This device: 1 • Backup: 3")).toBeTruthy();
    expect(getByText("This replaces the portfolio on this device. It does not merge portfolios.")).toBeTruthy();
    expect(restorePortfolioBackup).not.toHaveBeenCalled();
  });

  it("treats a cancelled backup picker as neutral and keeps restore inactive", async () => {
    const restorePortfolioBackup = jest.fn();
    const { getByTestId, queryByTestId } = renderScreen({
      restorePortfolioBackup,
      selectPortfolioBackup: async () => undefined,
    });

    fireEvent.press(getByTestId("choose-backup-file"));
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
    const { getByTestId, getByText, queryByTestId } = renderScreen({
      restorePortfolioBackup,
      selectPortfolioBackup,
    });

    fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("continue-restore-confirmation")).toBeTruthy());
    fireEvent.press(getByTestId("continue-restore-confirmation"));
    fireEvent.press(getByTestId("confirm-restore-replacement"));
    await waitFor(() => expect(restorePortfolioBackup).toHaveBeenCalledWith(prepared, expect.any(AbortSignal)));
    expect(getByText("Your portfolio changed. Select the backup again. Reopen the backup review or restart CogVest if recovery is required.")).toBeTruthy();
    expect(queryByTestId("backup-restore-preview")).toBeNull();
    expect(queryByTestId("backup-restore-confirmation")).toBeNull();
    fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(selectPortfolioBackup).toHaveBeenCalledTimes(2));
  });

  it("clears a stale review and reports selection errors without restoring", async () => {
    const selectPortfolioBackup = jest
      .fn()
      .mockResolvedValueOnce(prepared)
      .mockRejectedValueOnce(new Error("bad file"));
    const { getByTestId, getByText, queryByTestId } = renderScreen({ selectPortfolioBackup });

    fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("backup-restore-preview")).toBeTruthy());
    fireEvent.press(getByText("Choose another backup"));
    fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByText("bad file")).toBeTruthy());
    expect(queryByTestId("backup-restore-preview")).toBeNull();
  });

  it("backs up current data before confirmation and calls onRestored only after a successful replacement", async () => {
    const exportPortfolioBackup = jest.fn(async () => "before-restore.json");
    const onRestored = jest.fn();
    const { getByTestId } = renderScreen({ exportPortfolioBackup, onRestored });

    fireEvent.press(getByTestId("choose-backup-file"));
    await waitFor(() => expect(getByTestId("backup-current-data")).toBeTruthy());
    fireEvent.press(getByTestId("backup-current-data"));
    await waitFor(() => expect(exportPortfolioBackup).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getByTestId("backup-current-data").props.accessibilityState).toEqual({
        disabled: false,
      }),
    );
    fireEvent.press(getByTestId("continue-restore-confirmation"));
    await waitFor(() => expect(getByTestId("confirm-restore-replacement")).toBeTruthy());
    fireEvent.press(getByTestId("confirm-restore-replacement"));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
  });

  it("provides accessible Back and does not update or notify after unmount", async () => {
    let finishSelection: ((value: PreparedRestore | undefined) => void) | undefined;
    const onBack = jest.fn();
    const onRestored = jest.fn();
    const screen = renderScreen({
      onBack,
      onRestored,
      selectPortfolioBackup: () => new Promise((resolve) => { finishSelection = resolve; }),
    });

    fireEvent.press(screen.getByTestId("backup-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId("choose-backup-file"));
    screen.unmount();
    finishSelection?.(prepared);
    await Promise.resolve();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it("aborts an in-progress export when the screen unmounts", async () => {
    let finishExport: ((value: string | undefined) => void) | undefined;
    let receivedSignal: AbortSignal | undefined;
    const screen = renderScreen({
      exportPortfolioBackup: (signal) => {
        receivedSignal = signal;
        return new Promise((resolve) => { finishExport = resolve; });
      },
      initialMode: "export",
    });

    fireEvent.press(screen.getByTestId("choose-backup-location"));
    await waitFor(() => expect(receivedSignal).toBeDefined());
    screen.unmount();
    expect(receivedSignal?.aborted).toBe(true);
    finishExport?.("late-backup.json");
    await Promise.resolve();
  });
});
