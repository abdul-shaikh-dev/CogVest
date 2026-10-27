import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, ScrollView } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import type { TransactionImportSourceId } from "@/src/domain/transactionImportSources";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import type { AmfiSchemeLookupResult } from "@/src/services/mutualFunds/amfiSchemeCatalog";
import type { PortfolioStoreState, TransactionImportCommandResult } from "@/src/store";
import { spacing } from "@/src/theme";

import type {
  PickedCasStatement,
  PickedTransactionCsv,
  UseTransactionImportOptions,
} from "./useTransactionImport";
import { useTransactionImport } from "./useTransactionImport";
import { TransactionImportDryRun } from "./TransactionImportDryRun";
import {
  CasStatementReview,
  CutoverCard,
  HoldingMatchCard,
  ImportPreflightCard,
  SourceCoverageCard,
} from "./TransactionImportReviewCards";
import { TransactionImportSourceCard } from "./TransactionImportSourceCard";
import { useStyles } from "./transactionImportStyles";
import { getMatchGroups } from "./transactionImportViewModel";

type TransactionImportScreenProps = {
  lookupAmfiSchemeClassifications?: (input: { isins: string[] }) => Promise<AmfiSchemeLookupResult>;
  now?: () => Date;
  onAddPpfAccount?: () => void;
  onCancel: () => void;
  onImported: (result: TransactionImportCommandResult) => void;
  pickCasStatement?: () => Promise<PickedCasStatement | undefined>;
  pickCsvFile: () => Promise<PickedTransactionCsv | undefined>;
  readCasStatement?: UseTransactionImportOptions["readCasStatement"];
  openExternalUrl?: (url: string) => Promise<unknown>;
  saveCsvTemplate?: () => Promise<string | undefined>;
  searchAssetLookupResults?: (input: { query: string }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

export function TransactionImportScreen(props: TransactionImportScreenProps) {
  const styles = useStyles();
  const controller = useTransactionImport(props);
  const scrollRef = useRef<ScrollView>(null);
  const sourceCardYRef = useRef<number | undefined>(undefined);
  const passwordFieldYRef = useRef<number | undefined>(undefined);
  const [statementReviewY, setStatementReviewY] = useState<number>();
  const [showMatched, setShowMatched] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [showHoldings, setShowHoldings] = useState(false);
  const [showCasStatementDetails, setShowCasStatementDetails] = useState(false);
  const matchGroups = getMatchGroups(controller.groups);

  useEffect(() => {
    if (!controller.casReview || controller.isResolving || !statementReviewY) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, statementReviewY - spacing.md),
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [controller.casReview, controller.isResolving, statementReviewY]);

  function scrollPasswordIntoView() {
    if (!Keyboard.metrics() || sourceCardYRef.current === undefined || passwordFieldYRef.current === undefined) return;
    scrollRef.current?.scrollTo({ animated: false, y: Math.max(0, sourceCardYRef.current + passwordFieldYRef.current - spacing.md) });
  }

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      scrollPasswordIntoView();
    });
    return () => subscription.remove();
  }, []);

  function selectSource(sourceId: TransactionImportSourceId) {
    passwordFieldYRef.current = undefined;
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
    controller.setSourceId(sourceId);
    setShowCasStatementDetails(false);
  }

  function selectFile() {
    setShowCasStatementDetails(false);
    void controller.selectFile();
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex} onLayout={() => {
      requestAnimationFrame(scrollPasswordIntoView);
    }}>
    <ScreenContainer scroll scrollRef={scrollRef} testID="transaction-import-screen">
      <ScreenHeader
        leading={
          <IconButton
            accessibilityLabel="Go back"
            icon="chevron-back"
            onPress={props.onCancel}
            testID="transaction-import-back"
          />
        }
        title="Import history"
      />

      <TransactionImportSourceCard
        controller={controller}
        onAddPpfAccount={props.onAddPpfAccount}
        onCardLayout={(y) => { sourceCardYRef.current = y; }}
        onPasswordFocus={scrollPasswordIntoView}
        onPasswordLayout={(y) => { passwordFieldYRef.current = y; }}
        onSelectFile={selectFile}
        onSelectSource={selectSource}
        openExternalUrl={props.openExternalUrl}
        saveCsvTemplate={props.saveCsvTemplate}
      />
      {controller.isResolving ? (
        <PremiumCard testID="transaction-import-resolving">
          <AppText weight="bold">Checking transaction rows and matching holdings...</AppText>
          <AppText color="secondary" variant="caption">Nothing changes until you confirm the dry run.</AppText>
        </PremiumCard>
      ) : null}
      <ImportPreflightCard controller={controller} />
      <CasStatementReview
        controller={controller}
        onLayout={setStatementReviewY}
        onToggleDetails={() => setShowCasStatementDetails(!showCasStatementDetails)}
        showDetails={showCasStatementDetails}
      />

      <HoldingMatchCard
        controller={controller}
        matchGroups={matchGroups}
        onToggleAllSuggestions={() => setShowAllSuggestions(!showAllSuggestions)}
        onToggleMatched={() => setShowMatched(!showMatched)}
        showAllSuggestions={showAllSuggestions}
        showMatched={showMatched}
      />

      <CutoverCard controller={controller} />

      <SourceCoverageCard controller={controller} />

      <TransactionImportDryRun
        controller={controller}
        matchGroups={matchGroups}
        onToggleHoldings={() => setShowHoldings(!showHoldings)}
        showHoldings={showHoldings}
      />
    </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
