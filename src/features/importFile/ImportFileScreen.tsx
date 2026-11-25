import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, IconButton, PremiumCard, ScreenContainer, ScreenHeader } from "@/src/components/common";
import { importFileKindLabels, type ImportFileKind } from "@/src/domain/importFileDetection";
import { usePortfolioFields } from "@/src/hooks";
import type { ImportFileRef } from "@/src/services/import-export/importFileProbe";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";

import {
  casDestination,
  epfDestination,
  ppfDestination,
  routeForImportFile,
  supportedImportFilesText,
  type ImportFileDestination,
  type ImportFileRoute,
} from "./importFileViewModel";

type Props = {
  onBack: () => void;
  /** Hands the file to the chosen review, which reads it once. */
  onOpen: (file: ImportFileRef, destination: ImportFileDestination) => void;
  pickFile: () => Promise<ImportFileRef | undefined>;
  probeFile: (file: ImportFileRef) => Promise<ImportFileKind>;
  /** A file shared from another app, taken once on arrival. */
  takeSharedFile: () => ImportFileRef | null;
  store?: StoreApi<PortfolioStoreState>;
};

type Detected = { file: ImportFileRef; kind: ImportFileKind; route: ImportFileRoute };

/**
 * "Import a file" (#771): reads a chosen or shared statement's first bytes and
 * opens the matching import review. When it can't tell, it asks or explains.
 * Nothing is saved on this screen.
 */
export function ImportFileScreen({ onBack, onOpen, pickFile, probeFile, store = getPortfolioStore(), takeSharedFile }: Props) {
  const styles = useStyles();
  const { ppfAccounts } = usePortfolioFields(store, ["ppfAccounts"]);
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<Detected>();
  const [error, setError] = useState("");
  const takeSharedRef = useRef(takeSharedFile);

  async function detect(file: ImportFileRef) {
    setBusy(true);
    setError("");
    setDetected(undefined);
    try {
      const kind = await probeFile(file);
      const route = routeForImportFile(kind, ppfAccounts);
      if (route.kind === "open") {
        onOpen(file, { params: route.params, pathname: route.pathname });
        return;
      }
      setDetected({ file, kind, route });
    } catch {
      setError("This file could not be opened, so nothing was imported. Choose it again or try another copy.");
    } finally {
      setBusy(false);
    }
  }

  async function choose() {
    if (busy) return;
    setError("");
    let file: ImportFileRef | undefined;
    try {
      file = await pickFile();
    } catch {
      setError("The file picker could not open. Try again.");
      return;
    }
    if (file) await detect(file);
  }

  // A shared file is taken once, on arrival.
  useEffect(() => {
    const shared = takeSharedRef.current();
    if (shared) void detect(shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const route = detected?.route;
  return (
    <ScreenContainer scroll testID="import-file-screen">
      <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
          subtitle="CogVest opens the matching review. Nothing is saved until you confirm it."
          title="Import a file"
        />
        {detected && route ? (
          <PremiumCard section style={styles.card} testID="import-file-result">
            <AppText weight="bold">{detected.file.name}</AppText>
            <AppText color="secondary" testID="import-file-kind" variant="caption">
              {importFileKindLabels[detected.kind]}
            </AppText>
            {route.kind === "message" ? (
              <AppText accessibilityLiveRegion="polite" testID="import-file-message">{route.message}</AppText>
            ) : null}
            {route.kind === "choosePdf" ? (
              <>
                <AppText>Which statement is this?</AppText>
                <View style={styles.actions}>
                  <AppButton
                    onPress={() => onOpen(detected.file, casDestination)}
                    testID="import-file-pdf-cas"
                    title="CAMS + KFintech CAS"
                  />
                  <AppButton
                    onPress={() => onOpen(detected.file, epfDestination)}
                    testID="import-file-pdf-epf"
                    title="EPF passbook"
                    variant="secondary"
                  />
                </View>
              </>
            ) : null}
            {route.kind === "choosePpfAccount" ? (
              <>
                <AppText>Which PPF account is this statement for?</AppText>
                <View style={styles.actions}>
                  {route.accounts.map((account) => (
                    <AppButton
                      key={account.id}
                      onPress={() => onOpen(detected.file, ppfDestination(account.id))}
                      testID={`import-file-ppf-${account.id}`}
                      title={account.nickname}
                      variant="secondary"
                    />
                  ))}
                </View>
              </>
            ) : null}
          </PremiumCard>
        ) : null}
        {error ? (
          <AppText accessibilityLiveRegion="polite" style={styles.error} testID="import-file-error">{error}</AppText>
        ) : null}
        <AppButton
          disabled={busy}
          onPress={choose}
          testID="import-file-choose"
          title={busy ? "Reading file..." : detected ? "Choose another file" : "Choose a file"}
          variant={detected ? "secondary" : "primary"}
        />
        <AppText color="secondary" variant="caption">
          {`Supported: ${supportedImportFilesText}. You can also share a statement to CogVest from another app.`}
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.xs },
  card: { gap: spacing.xs },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
}));
