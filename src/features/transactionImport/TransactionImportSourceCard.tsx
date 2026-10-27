import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, View } from "react-native";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  SectionHeader,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import {
  transactionImportSources,
  type TransactionImportSourceId,
} from "@/src/domain/transactionImportSources";
import { useTheme } from "@/src/theme";

import { importSourceGuidance } from "./importSourceGuidance";
import { InlineError, SourceAction, SourceChoice } from "./TransactionImportParts";
import { useStyles } from "./transactionImportStyles";
import {
  fileSizeLabel,
  hasSelectedImportInput,
  importFileName,
  parseErrorText,
  selectFileAction,
  sourceLimitText,
} from "./transactionImportViewModel";
import type { TransactionImportController } from "./useTransactionImport";

type TransactionImportSourceCardProps = {
  controller: TransactionImportController;
  onAddPpfAccount?: () => void;
  onCardLayout: (y: number) => void;
  onPasswordFocus: () => void;
  onPasswordLayout: (y: number) => void;
  onSelectFile: () => void;
  onSelectSource: (sourceId: TransactionImportSourceId) => void;
  openExternalUrl?: (url: string) => Promise<unknown>;
  saveCsvTemplate?: () => Promise<string | undefined>;
};

/**
 * Source choice, how to get the file, limits, the selected files or
 * statement, and file errors.
 */
export function TransactionImportSourceCard({
  controller,
  onAddPpfAccount,
  onCardLayout,
  onPasswordFocus,
  onPasswordLayout,
  onSelectFile,
  onSelectSource,
  openExternalUrl,
  saveCsvTemplate,
}: TransactionImportSourceCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [templateStatus, setTemplateStatus] = useState<string>();
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [externalLinkStatus, setExternalLinkStatus] = useState<string>();
  const [showSourceHelp, setShowSourceHelp] = useState(false);
  const hasSelectedInput = hasSelectedImportInput(controller);
  const sourceGuidance = importSourceGuidance[controller.sourceId];
  const isCas = controller.sourceId === "camsKfinCasPdfV1";
  const isTradebook = controller.sourceId === "zerodhaTradebookEqV1";
  const fileAction = selectFileAction(controller.sourceId, hasSelectedInput);

  function chooseSource(sourceId: TransactionImportSourceId) {
    if (sourceId === controller.sourceId) return;
    onSelectSource(sourceId);
    setExternalLinkStatus(undefined);
    setShowSourceHelp(false);
  }

  async function openSourceWebsite() {
    const guidance = importSourceGuidance[controller.sourceId];
    if (!guidance) return;
    setExternalLinkStatus(undefined);
    try {
      await (openExternalUrl ?? Linking.openURL)(guidance.officialUrl);
    } catch {
      setExternalLinkStatus(`Could not open the website. In your browser, visit ${guidance.browserFallback}.`);
    }
  }

  async function saveTemplate() {
    if (!saveCsvTemplate || isSavingTemplate) return;
    setIsSavingTemplate(true);
    try {
      const name = await saveCsvTemplate();
      if (name) setTemplateStatus(`${name} saved. Replace the example rows, then choose the completed CSV.`);
    } catch {
      setTemplateStatus("The template could not be saved. Choose another folder and try again.");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  return (
    <View
      onLayout={(event) => { onCardLayout(event.nativeEvent.layout.y); }}
      testID="transaction-import-source-card"
    >
      <PremiumCard section style={styles.card}>
        <SectionHeader title="Choose a source" />
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Import source"
          testID="transaction-import-sources"
          style={styles.sourceList}
        >
          {transactionImportSources.map((source) => (
            <SourceChoice
              active={controller.sourceId === source.id}
              description={source.description}
              key={source.id}
              onPress={() => chooseSource(source.id)}
              testID={`transaction-import-source-${source.id}`}
              title={source.label}
            />
          ))}
        </View>
        {onAddPpfAccount ? (
          <SourceAction
            description="Import PPF history with the account's CSV template."
            onPress={onAddPpfAccount}
            testID="transaction-import-source-ppf"
            title="PPF CSV"
          />
        ) : null}
        <AppText color="secondary" variant="caption">Files stay on this device.</AppText>
        {!hasSelectedInput ? (
          <AppButton
            disabled={controller.isResolving || controller.isSaving}
            onPress={onSelectFile}
            testID={fileAction.testID}
            title={fileAction.title}
          />
        ) : null}
        {sourceGuidance ? <View style={styles.guide} testID="transaction-import-source-guide">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showSourceHelp }}
            onPress={() => setShowSourceHelp(!showSourceHelp)}
            testID="transaction-import-toggle-source-guide"
            style={({ pressed }) => [styles.helpRow, pressed && styles.pressed]}
          >
            <AppText style={styles.sourceCopy} weight="medium">{`How to get a ${sourceGuidance.fileLabel}`}</AppText>
            <Ionicons
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              name={showSourceHelp ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
          {showSourceHelp ? <View style={styles.guide} testID="transaction-import-source-guide-details">
            <View style={styles.divider} />
            <SectionHeader title={`Get your ${sourceGuidance.fileLabel}`} />
            {sourceGuidance.steps.map((step, index) => (
              <View key={step} style={styles.guideStep}>
                <AppText style={styles.stepNumber} weight="bold">{index + 1}</AppText>
                <AppText color="secondary" style={styles.guideStepText}>{step}</AppText>
              </View>
            ))}
            <AppButton
              onPress={openSourceWebsite}
              testID="open-import-source-website"
              title="Open official instructions"
              variant="secondary"
            />
            <AppText color="secondary" variant="caption">
              Instructions verified {sourceGuidance.verifiedOn}. The provider website opens outside CogVest.
            </AppText>
            {externalLinkStatus ? (
              <AppText
                accessibilityLiveRegion="polite"
                color="secondary"
                testID="import-source-link-fallback"
                variant="caption"
              >
                {externalLinkStatus}
              </AppText>
            ) : null}
          </View> : null}
        </View> : null}
        <View style={styles.limits} testID="transaction-import-limits">
          <AppText color="secondary" variant="caption">
            {sourceLimitText(controller.sourceId, controller.maxRows)}
          </AppText>
          {isTradebook ? <>
            <AppText color="secondary" variant="caption">
              Up to {controller.maxFiles} Tradebooks; Console allows 365 days per file.
            </AppText>
            <AppText color="secondary" variant="caption">Overlapping trades are checked before import.</AppText>
          </> : null}
          <AppText color="secondary" variant="caption">Unsupported events stay visible and are never guessed.</AppText>
        </View>
        {controller.sourceId === "cogvestCsvV1" ? <>
          <AppButton
            disabled={!saveCsvTemplate || isSavingTemplate || controller.isResolving || controller.isSaving}
            onPress={saveTemplate}
            testID="save-transaction-csv-template"
            title={isSavingTemplate ? "Saving template..." : "Save CSV template"}
            variant="secondary"
          />
          {templateStatus ? (
            <AppText color="secondary" testID="transaction-csv-template-status" variant="caption">
              {templateStatus}
            </AppText>
          ) : null}
        </> : isCas ? <>
          <AppText color="secondary" variant="caption">Read on this device. Password never saved.</AppText>
          <View
            collapsable={false}
            onLayout={(event) => { onPasswordLayout(event.nativeEvent.layout.y); }}
            testID="cas-statement-password-field"
          >
            <FormTextField
              label="PDF password (if required)"
              onChangeText={controller.setCasPassword}
              onFocus={() => {
                onPasswordFocus();
              }}
              returnKeyType="done"
              secureTextEntry
              testID="cas-statement-password"
              value={controller.casPassword}
            />
          </View>
        </> : null}
        {controller.files.length > 0 ? <View style={styles.fileList}>
          {controller.files.map((file, index) => (
            <View key={file.id} style={styles.fileRow} testID={`transaction-import-file-${index}`}>
              <View style={styles.fileDetails}>
                <AppText numberOfLines={1} weight="bold">{`${index + 1}. ${importFileName(file.name)}`}</AppText>
                <AppText color="secondary" variant="caption">
                  {controller.fileSummaries[file.id] ?? fileSizeLabel(file.size)}
                </AppText>
              </View>
              {index > 0 ? (
                <IconButton
                  accessibilityLabel={`Move ${file.name} earlier`}
                  icon="chevron-up"
                  onPress={() => controller.moveFile(file.id, -1)}
                  testID={`transaction-import-file-${index}-up`}
                />
              ) : null}
              {index < controller.files.length - 1 ? (
                <IconButton
                  accessibilityLabel={`Move ${file.name} later`}
                  icon="chevron-down"
                  onPress={() => controller.moveFile(file.id, 1)}
                  testID={`transaction-import-file-${index}-down`}
                />
              ) : null}
              <IconButton
                accessibilityLabel={`Remove ${file.name}`}
                icon="trash-outline"
                onPress={() => controller.removeFile(file.id)}
                testID={`transaction-import-file-${index}-remove`}
              />
            </View>
          ))}
        </View> : null}
        {isCas && controller.casSource ? (
          <View style={styles.statementSelection} testID="cas-statement-selected">
            <View style={styles.fileDetails}>
              <AppText weight="bold">Statement selected</AppText>
              <AppText color="secondary" variant="caption">
                {`${fileSizeLabel(controller.casSource.size)}${controller.casReview ? ` • ${controller.casReview.pageCount} pages` : ""}`}
              </AppText>
            </View>
            <AppButton
              disabled={controller.isResolving || controller.isSaving}
              onPress={controller.retryCasStatement}
              testID="read-cas-statement"
              title="Read statement"
              variant="secondary"
            />
          </View>
        ) : null}
        {hasSelectedInput ? (
          <AppButton
            disabled={controller.isResolving || controller.isSaving || (isTradebook && controller.files.length >= controller.maxFiles)}
            onPress={onSelectFile}
            testID={fileAction.testID}
            title={fileAction.title}
          />
        ) : null}
        {controller.screenError ? (
          <InlineError message={controller.screenError} testID="transaction-import-screen-error" />
        ) : null}
        {controller.parseErrors.map((error, index) => (
          <InlineError key={`${error.code}-${error.rowNumber ?? index}`} message={parseErrorText(error)} />
        ))}
      </PremiumCard>
    </View>
  );
}
