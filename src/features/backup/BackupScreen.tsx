import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { usePreventRemove } from "expo-router/react-navigation";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  getAdaptiveLayoutMode,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { backupPassphraseProblem } from "@/src/domain/encryptedBackup";
import { Checkbox } from "@/src/features/ppf/ppfImportParts";
import { spacing, createThemedStyles } from "@/src/theme";
import { useFocusedBackHandler } from "@/src/hooks";

export type BackupReview = {
  appVersion: string;
  counts: Array<{ backup: number; current: number; label: string }>;
  createdAt: string;
};

export type PreparedRestore = {
  review: BackupReview;
};

/** A picked backup that is protected with a passphrase (#760). */
export type LockedRestore = { locked: true };

type BackupScreenProps = {
  exportPortfolioBackup: (signal?: AbortSignal, options?: { passphrase?: string }) => Promise<string | undefined>;
  initialMode?: "export" | "restore";
  onBack: () => void;
  onRestored: () => void;
  restorePortfolioBackup: (prepared: PreparedRestore, signal?: AbortSignal) => Promise<void>;
  selectPortfolioBackup: (signal?: AbortSignal) => Promise<PreparedRestore | LockedRestore | undefined>;
  unlockPortfolioBackup: (locked: LockedRestore, passphrase: string, signal?: AbortSignal) => Promise<PreparedRestore>;
};

type RestoreStep = "confirmation" | "preview" | "unlock" | "warning";

export function formatBackupCreatedAt(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "an unavailable date";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function safeErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  // Service errors are deliberately short operational guidance. Reject values
  // that could contain provider paths, record values, or other raw data.
  return message.length > 0 && message.length <= 240 && /^[A-Za-z .,;:'!?()/-]+$/u.test(message)
    ? message
    : fallback;
}

export function BackupScreen({
  exportPortfolioBackup,
  initialMode = "export",
  onBack,
  onRestored,
  restorePortfolioBackup,
  selectPortfolioBackup,
  unlockPortfolioBackup,
}: BackupScreenProps) {
  const styles = useStyles();
  const { fontScale, width } = useWindowDimensions();
  const stackedCounts = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  const [isBusy, setIsBusy] = useState(false);
  const [prepared, setPrepared] = useState<PreparedRestore>();
  const [lockedBackup, setLockedBackup] = useState<LockedRestore>();
  const [protect, setProtect] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passphraseError, setPassphraseError] = useState<string>();
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [restoreStep, setRestoreStep] = useState<RestoreStep>("warning");
  const [status, setStatus] = useState<string>();
  const isMounted = useRef(true);
  const operationRef = useRef<AbortController | undefined>(undefined);

  const handleBack = useCallback(() => {
    if (operationRef.current) return;
    if (restoreStep === "confirmation") {
      setStatus(undefined);
      setRestoreStep("preview");
    } else if (restoreStep === "preview" || restoreStep === "unlock") {
      setPrepared(undefined);
      setLockedBackup(undefined);
      setUnlockPassphrase("");
      setStatus(undefined);
      setRestoreStep("warning");
    } else {
      onBack();
    }
  }, [onBack, restoreStep]);

  usePreventRemove(isBusy || restoreStep !== "warning", handleBack);
  useFocusedBackHandler(handleBack);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      operationRef.current?.abort();
      operationRef.current = undefined;
    };
  }, []);

  function updateAfterAsync(update: () => void) {
    if (isMounted.current) update();
  }

  function startOperation() {
    if (operationRef.current) return undefined;
    const operation = new AbortController();
    operationRef.current = operation;
    setIsBusy(true);
    return operation;
  }

  function finishOperation(operation: AbortController) {
    if (operationRef.current !== operation) return;
    operationRef.current = undefined;
    updateAfterAsync(() => setIsBusy(false));
  }

  async function backUpPortfolio(withPassphrase: boolean) {
    if (withPassphrase) {
      const problem = backupPassphraseProblem(passphrase)
        ?? (confirmation !== passphrase ? "The passphrases do not match." : undefined);
      setPassphraseError(problem);
      if (problem) return;
    }
    const operation = startOperation();
    if (!operation) return;
    setStatus(undefined);
    try {
      const fileName = await exportPortfolioBackup(operation.signal, withPassphrase ? { passphrase } : undefined);
      updateAfterAsync(() => {
        if (!fileName) return;
        if (withPassphrase) {
          // Keep the passphrase on screen no longer than the export needs it.
          setPassphrase("");
          setConfirmation("");
          setStatus(`${fileName} saved. It opens only with its passphrase; CogVest does not keep a copy.`);
        } else {
          setStatus(`${fileName} saved. Keep this unencrypted file somewhere you trust.`);
        }
      });
    } catch (error) {
      updateAfterAsync(() => setStatus(safeErrorMessage(
        error,
        "The backup could not be saved. Your portfolio is unchanged. Try another location.",
      )));
    } finally {
      finishOperation(operation);
    }
  }

  async function chooseBackup() {
    const operation = startOperation();
    if (!operation) return;
    setStatus(undefined);
    setPrepared(undefined);
    setRestoreStep("warning");
    try {
      const picked = await selectPortfolioBackup(operation.signal);
      updateAfterAsync(() => {
        if (!picked) return;
        if ("locked" in picked) {
          setLockedBackup(picked);
          setUnlockPassphrase("");
          setRestoreStep("unlock");
        } else {
          setPrepared(picked);
          setRestoreStep("preview");
        }
      });
    } catch (error) {
      updateAfterAsync(() => setStatus(safeErrorMessage(
        error,
        "This backup could not be reviewed. Your portfolio is unchanged. Choose another backup file.",
      )));
    } finally {
      finishOperation(operation);
    }
  }

  async function unlockBackup() {
    if (!lockedBackup || unlockPassphrase.length === 0) return;
    const operation = startOperation();
    if (!operation) return;
    setStatus(undefined);
    try {
      const nextPrepared = await unlockPortfolioBackup(lockedBackup, unlockPassphrase, operation.signal);
      updateAfterAsync(() => {
        setLockedBackup(undefined);
        setUnlockPassphrase("");
        setPrepared(nextPrepared);
        setRestoreStep("preview");
      });
    } catch (error) {
      updateAfterAsync(() => {
        const message = safeErrorMessage(error, "This backup could not be opened. Your portfolio has not changed.");
        // A wrong passphrase can be tried again; anything else means choosing the file again.
        if (!/passphrase is wrong/iu.test(message)) {
          setLockedBackup(undefined);
          setUnlockPassphrase("");
          setRestoreStep("warning");
        }
        setStatus(message);
      });
    } finally {
      finishOperation(operation);
    }
  }

  async function replacePortfolio() {
    if (!prepared || restoreStep !== "confirmation") return;
    const operation = startOperation();
    if (!operation) return;
    setStatus(undefined);
    try {
      await restorePortfolioBackup(prepared, operation.signal);
      updateAfterAsync(onRestored);
    } catch (error) {
      updateAfterAsync(() => {
        setPrepared(undefined);
        setRestoreStep("warning");
        setStatus(`${safeErrorMessage(error, "Restore did not finish.")} Reopen the backup review or restart CogVest if recovery is required.`);
      });
    } finally {
      finishOperation(operation);
    }
  }

  const isRestore = initialMode === "restore";
  const title = isRestore ? "Restore backup" : "Back up portfolio";

  return (
    <ScreenContainer scroll testID="backup-screen">
      <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back" disabled={isBusy} icon="chevron-back" onPress={handleBack} testID="backup-back" />}
          subtitle={isRestore ? "Review before replacing this device's portfolio" : undefined}
          title={title}
        />

        {status ? (
          <PremiumCard testID="backup-status">
            <AppText accessibilityLiveRegion="polite" color="secondary">{status}</AppText>
          </PremiumCard>
        ) : null}

        {!isRestore ? (
        <PremiumCard style={styles.card} testID="backup-export-warning">
          <SectionHeader title="Save a manual backup" />
          <AppText color="secondary">
            {protect
              ? "This backup contains sensitive financial information. It will be encrypted with your passphrase."
              : "This backup contains sensitive financial information and is not encrypted."}
          </AppText>
          <AppText color="secondary" variant="caption">
            Choose a location you trust. Your document provider may sync the file; CogVest does not upload it.
          </AppText>
          <Checkbox
            checked={protect}
            disabled={isBusy}
            label="Protect with a passphrase"
            onPress={() => {
              setProtect((value) => !value);
              setPassphraseError(undefined);
            }}
            testID="backup-protect"
          />
          {protect ? (
            <View style={styles.card} testID="backup-passphrase-fields">
              <FormTextField
                error={passphraseError}
                label="Passphrase"
                onChangeText={(value) => {
                  setPassphrase(value);
                  setPassphraseError(undefined);
                }}
                secureTextEntry
                testID="backup-passphrase"
                value={passphrase}
              />
              <FormTextField
                label="Confirm passphrase"
                onChangeText={(value) => {
                  setConfirmation(value);
                  setPassphraseError(undefined);
                }}
                secureTextEntry
                testID="backup-passphrase-confirm"
                value={confirmation}
              />
              <AppText color="secondary" testID="backup-passphrase-hint" variant="caption">
                Use at least 8 characters; a few unrelated words work well. If you forget the passphrase,
                this backup cannot be opened. CogVest does not store it.
              </AppText>
            </View>
          ) : null}
          <AppButton
            accessibilityHint="Opens Android's file location picker."
            disabled={isBusy}
            onPress={() => void backUpPortfolio(protect)}
            testID="choose-backup-location"
            title={isBusy ? (protect ? "Encrypting and saving..." : "Saving backup...") : "Choose backup location"}
          />
        </PremiumCard>
        ) : null}

        {isRestore && restoreStep === "warning" ? (
        <PremiumCard style={styles.card} testID="backup-restore-warning">
          <SectionHeader title="Choose a backup to review" />
          <AppText color="secondary">
            Selecting a file only checks it. Nothing is restored until you review and confirm replacement.
          </AppText>
          <AppText color="secondary" variant="caption">
            Only choose a file from a source you trust. A passphrase-protected backup asks for its passphrase next.
          </AppText>
          <AppButton
            disabled={isBusy}
            onPress={() => void chooseBackup()}
            testID="choose-backup-file"
            title={isBusy ? "Reviewing backup..." : "Choose backup file"}
          />
        </PremiumCard>
        ) : null}

        {isRestore && lockedBackup && restoreStep === "unlock" ? (
        <PremiumCard style={styles.card} testID="backup-restore-unlock">
          <SectionHeader title="Enter the backup's passphrase" />
          <AppText color="secondary">This backup is protected. Enter the passphrase used when it was saved.</AppText>
          <FormTextField
            label="Passphrase"
            onChangeText={setUnlockPassphrase}
            onSubmitEditing={() => void unlockBackup()}
            returnKeyType="done"
            secureTextEntry
            testID="backup-unlock-passphrase"
            value={unlockPassphrase}
          />
          <AppText color="secondary" variant="caption">
            Unlocking only reads the file. Nothing changes until you review and confirm replacement.
          </AppText>
          <AppButton
            disabled={isBusy || unlockPassphrase.length === 0}
            onPress={() => void unlockBackup()}
            testID="backup-unlock"
            title={isBusy ? "Unlocking backup..." : "Unlock backup"}
          />
          <AppButton disabled={isBusy} onPress={handleBack} title="Choose another backup" variant="ghost" />
        </PremiumCard>
        ) : null}

        {isRestore && prepared && restoreStep === "preview" ? (
        <PremiumCard style={styles.card} testID="backup-restore-preview">
          <SectionHeader title="Review backup" />
          <AppText color="secondary" variant="caption">Created {formatBackupCreatedAt(prepared.review.createdAt)}</AppText>
          <AppText color="secondary" variant="caption">CogVest version {prepared.review.appVersion}</AppText>
          <View style={styles.counts}>
            {!stackedCounts ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.countRow} testID="backup-count-headings">
              <AppText color="secondary" style={styles.countName} variant="caption">Records</AppText>
              <View style={styles.countValues}>
                <AppText color="secondary" style={styles.countValue} variant="caption">This device</AppText>
                <AppText color="secondary" style={styles.countValue} variant="caption">Backup</AppText>
              </View>
            </View> : null}
            {prepared.review.counts.map((count) => (
              <View accessible accessibilityLabel={`${count.label}. This device: ${count.current}. Backup: ${count.backup}.`} key={count.label} style={[styles.countRow, styles.countRecord, stackedCounts && styles.countRowStacked]} testID={`backup-count-${count.label}`}>
                <AppText style={!stackedCounts && styles.countName} weight="medium">{count.label}</AppText>
                <View style={[styles.countValues, stackedCounts && styles.countValuesStacked]}>
                  <View style={styles.countCell}>
                    {stackedCounts ? <AppText color="secondary" variant="caption">This device</AppText> : null}
                    <AppText color="secondary" style={[styles.countNumber, !stackedCounts && styles.countRight]} testID={`backup-count-current-${count.label}`}>{count.current}</AppText>
                  </View>
                  <View style={styles.countCell}>
                    {stackedCounts ? <AppText color="secondary" variant="caption">Backup</AppText> : null}
                    <AppText style={[styles.countNumber, !stackedCounts && styles.countRight]} testID={`backup-count-file-${count.label}`} weight="bold">{count.backup}</AppText>
                  </View>
                </View>
              </View>
            ))}
          </View>
          <AppText color="secondary">This replaces the portfolio on this device. It does not merge portfolios.</AppText>
          <AppText color="secondary" variant="caption">Display preferences in this backup replace the settings on this device. Value masking and screenshot blocking stay as they are on this device.</AppText>
          <AppText color="secondary" variant="caption">Saved prices keep their source details. Prices may be out of date.</AppText>
          <AppButton disabled={isBusy} onPress={() => void backUpPortfolio(false)} testID="backup-current-data" title={isBusy ? "Saving backup..." : "Back up current data first"} variant="secondary" />
          <AppButton disabled={isBusy} onPress={() => setRestoreStep("confirmation")} testID="continue-restore-confirmation" title="Review replacement" />
          <AppButton disabled={isBusy} onPress={() => { setPrepared(undefined); setRestoreStep("warning"); }} title="Choose another backup" variant="ghost" />
        </PremiumCard>
        ) : null}

        {isRestore && prepared && restoreStep === "confirmation" ? (
        <PremiumCard style={styles.card} testID="backup-restore-confirmation">
          <SectionHeader title="Replace this portfolio?" />
          <AppText color="secondary">This replaces the portfolio on this device. It does not merge portfolios.</AppText>
          <AppText color="secondary" variant="caption">The backup was created {formatBackupCreatedAt(prepared.review.createdAt)}. This action cannot be undone from this screen.</AppText>
          <AppButton disabled={isBusy} onPress={handleBack} title="Back to review" variant="secondary" />
          <AppButton disabled={isBusy} onPress={() => void replacePortfolio()} testID="confirm-restore-replacement" title={isBusy ? "Replacing portfolio..." : "Replace this device's portfolio"} variant="destructive" />
        </PremiumCard>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: { gap: spacing.md },
  content: { gap: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.md },
  countRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  countRecord: { borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth },
  countRowStacked: { alignItems: "stretch", flexDirection: "column", gap: spacing.sm },
  countName: { flex: 1 },
  countValues: { flex: 1, flexDirection: "row", gap: spacing.sm },
  countValuesStacked: { flex: 0 },
  countCell: { flex: 1, gap: spacing.xs },
  countValue: { flex: 1, textAlign: "right" },
  countNumber: { fontVariant: ["tabular-nums"] },
  countRight: { textAlign: "right" },
  counts: { gap: spacing.xs },
}));
