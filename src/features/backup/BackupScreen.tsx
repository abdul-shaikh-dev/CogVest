import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { colors, spacing } from "@/src/theme";

export type BackupReview = {
  appVersion: string;
  counts: Array<{ backup: number; current: number; label: string }>;
  createdAt: string;
};

export type PreparedRestore = {
  review: BackupReview;
};

type BackupScreenProps = {
  exportPortfolioBackup: (signal?: AbortSignal) => Promise<string | undefined>;
  initialMode?: "export" | "restore";
  onBack: () => void;
  onRestored: () => void;
  restorePortfolioBackup: (prepared: PreparedRestore, signal?: AbortSignal) => Promise<void>;
  selectPortfolioBackup: (signal?: AbortSignal) => Promise<PreparedRestore | undefined>;
};

type RestoreStep = "confirmation" | "preview" | "warning";

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
}: BackupScreenProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [prepared, setPrepared] = useState<PreparedRestore>();
  const [restoreStep, setRestoreStep] = useState<RestoreStep>("warning");
  const [status, setStatus] = useState<string>();
  const isMounted = useRef(true);
  const operationRef = useRef<AbortController | undefined>(undefined);

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

  async function backUpPortfolio() {
    const operation = startOperation();
    if (!operation) return;
    setStatus(undefined);
    try {
      const fileName = await exportPortfolioBackup(operation.signal);
      updateAfterAsync(() => {
        if (fileName) setStatus(`${fileName} saved. Keep this unencrypted file somewhere you trust.`);
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
      const nextPrepared = await selectPortfolioBackup(operation.signal);
      updateAfterAsync(() => {
        if (nextPrepared) {
          setPrepared(nextPrepared);
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

  async function replacePortfolio() {
    if (!prepared) return;
    const operation = startOperation();
    if (!operation) return;
    setStatus(undefined);
    try {
      await restorePortfolioBackup(prepared, operation.signal);
      if (isMounted.current) onRestored();
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
          leading={<IconButton accessibilityLabel="Back" icon="chevron-back" onPress={() => { if (!isBusy) onBack(); }} testID="backup-back" />}
          subtitle={isRestore ? "Review before replacing local data" : "Manual file • local control"}
          title={title}
        />

        {status ? (
          <PremiumCard testID="backup-status">
            <AppText color="secondary">{status}</AppText>
          </PremiumCard>
        ) : null}

        {!isRestore ? (
        <PremiumCard style={styles.card} testID="backup-export-warning">
          <SectionHeader title="Save a manual backup" />
          <AppText color="secondary">
            This backup contains sensitive financial information and is not encrypted.
          </AppText>
          <AppText color="secondary" variant="caption">
            Choose a location you trust. Your document provider may sync the file; CogVest does not upload it.
          </AppText>
          <AppButton
            accessibilityHint="Opens Android's file location picker."
            disabled={isBusy}
            onPress={() => void backUpPortfolio()}
            testID="choose-backup-location"
            title={isBusy ? "Saving backup..." : "Choose backup location"}
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
            Backups are not encrypted. Only choose a file from a source you trust.
          </AppText>
          <AppButton
            disabled={isBusy}
            onPress={() => void chooseBackup()}
            testID="choose-backup-file"
            title={isBusy ? "Reviewing backup..." : "Choose backup file"}
          />
        </PremiumCard>
        ) : null}

        {isRestore && prepared && restoreStep === "preview" ? (
        <PremiumCard style={styles.card} testID="backup-restore-preview">
          <SectionHeader title="Review backup" />
          <AppText color="secondary" variant="caption">Created {formatBackupCreatedAt(prepared.review.createdAt)}</AppText>
          <AppText color="secondary" variant="caption">CogVest version {prepared.review.appVersion}</AppText>
          <View style={styles.counts}>
            {prepared.review.counts.map((count) => (
              <View key={count.label} style={styles.countRow}>
                <AppText weight="bold">{count.label}</AppText>
                <AppText color="secondary" variant="caption">This device: {count.current} • Backup: {count.backup}</AppText>
              </View>
            ))}
          </View>
          <AppText color="secondary">This replaces the portfolio on this device. It does not merge portfolios.</AppText>
          <AppText color="secondary" variant="caption">Display mode and value masking preferences in this backup replace the settings on this device.</AppText>
          <AppText color="secondary" variant="caption">Saved price source provenance is retained. Prices may not be current.</AppText>
          <AppButton disabled={isBusy} onPress={() => void backUpPortfolio()} testID="backup-current-data" title={isBusy ? "Saving backup..." : "Back up current data first"} variant="secondary" />
          <AppButton disabled={isBusy} onPress={() => setRestoreStep("confirmation")} testID="continue-restore-confirmation" title="Continue to replacement confirmation" />
          <AppButton disabled={isBusy} onPress={() => { setPrepared(undefined); setRestoreStep("warning"); }} title="Choose another backup" variant="ghost" />
        </PremiumCard>
        ) : null}

        {isRestore && prepared && restoreStep === "confirmation" ? (
        <PremiumCard style={styles.card} testID="backup-restore-confirmation">
          <SectionHeader title="Replace this portfolio?" />
          <AppText color="secondary">This replaces the portfolio on this device. It does not merge portfolios.</AppText>
          <AppText color="secondary" variant="caption">The backup was created {formatBackupCreatedAt(prepared.review.createdAt)}. This action cannot be undone from this screen.</AppText>
          <AppButton disabled={isBusy} onPress={() => setRestoreStep("preview")} title="Back to review" variant="secondary" />
          <AppButton disabled={isBusy} onPress={() => void replacePortfolio()} testID="confirm-restore-replacement" title={isBusy ? "Replacing portfolio..." : "Replace this device's portfolio"} variant="destructive" />
        </PremiumCard>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  content: { gap: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.md },
  countRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  counts: { borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingTop: spacing.sm },
});
