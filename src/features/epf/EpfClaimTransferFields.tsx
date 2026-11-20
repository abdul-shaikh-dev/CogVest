import { StyleSheet, type TextInputInstance, View, type ViewInstance } from "react-native";

import { AppButton, AppText, SectionHeader } from "@/src/components/common";
import { DatePickerField, FormTextField, SelectionField } from "@/src/components/forms";
import type { EpfAccount } from "@/src/domain/epf";
import { createThemedStyles, spacing } from "@/src/theme";
import {
  claimCreditField,
  emptyClaimCredit,
  MAX_CLAIM_CREDITS,
  type EpfClaimCreditDraft,
  type EpfClaimCreditPart,
} from "./epfClaimTransferForm";
import type { EpfEntryDraft, EpfEntryField } from "./epfEntryForm";

type Props = {
  draft: EpfEntryDraft;
  errors: Partial<Record<EpfEntryField, string>>;
  registerField: (field: EpfEntryField, node: TextInputInstance | ViewInstance | null) => void;
  now: Date;
  otherAccounts: readonly EpfAccount[];
  update: <Key extends keyof EpfEntryDraft>(key: Key, value: EpfEntryDraft[Key]) => void;
  clearError: (field: EpfEntryField) => void;
};

/**
 * Old passbook: the claim and the interest paid inside it. New passbook: each
 * credit that cites the old member ID, which can arrive before the claim (#735).
 */
export function EpfClaimTransferFields({ draft, errors, registerField, now, otherAccounts, update, clearError }: Props) {
  const styles = useStyles();
  if (otherAccounts.length === 0) {
    return (
      <AppText color="secondary" testID="epf-entry-no-target">
        Add the new EPF account first, then record the move here.
      </AppText>
    );
  }
  const setCredit = (index: number, key: keyof EpfClaimCreditDraft, value: string) => {
    update("credits", draft.credits.map((credit, position) => position === index ? { ...credit, [key]: value } : credit));
    const part = (key[0].toUpperCase() + key.slice(1)) as EpfClaimCreditPart;
    clearError(claimCreditField(index, part));
  };
  const text = (field: EpfEntryField, label: string, testID: string, value: string, onChange: (value: string) => void) => (
    <FormTextField error={errors[field]} inputRef={(node) => registerField(field, node)}
      keyboardType="decimal-pad" label={label} onChangeText={onChange} testID={testID} value={value} />
  );

  return (
    <>
      <View ref={(node) => registerField("targetAccountId", node)}>
        <SelectionField label="Moved to" onChange={(value) => update("targetAccountId", value)}
          options={otherAccounts.map((item) => ({ label: item.nickname, value: item.id }))}
          testIDPrefix="epf-claim-target" value={draft.targetAccountId} />
        {errors.targetAccountId ? <AppText style={styles.error} variant="caption">{errors.targetAccountId}</AppText> : null}
      </View>
      <SectionHeader title="Old account's claim" />
      <AppText color="secondary" variant="caption">
        From the old passbook's claim row. The claim includes interest up to the claim date, which the passbook prints on the year-end line.
      </AppText>
      {text("amount", "Claim amount (INR)", "epf-claim-amount-input", draft.amount, (value) => update("amount", value))}
      {text("employee", "Employee part (optional)", "epf-claim-employee-input", draft.employee, (value) => update("employee", value))}
      {text("employer", "Employer part (optional)", "epf-claim-employer-input", draft.employer, (value) => update("employer", value))}
      {text("settlementInterest", "Interest paid with the claim (INR)", "epf-claim-interest-input", draft.settlementInterest,
        (value) => update("settlementInterest", value))}
      {text("settlementInterestEmployee", "Employee interest (optional)", "epf-claim-interest-employee-input",
        draft.settlementInterestEmployee, (value) => update("settlementInterestEmployee", value))}
      {text("settlementInterestEmployer", "Employer interest (optional)", "epf-claim-interest-employer-input",
        draft.settlementInterestEmployer, (value) => update("settlementInterestEmployer", value))}

      <SectionHeader title="Credits on the new account" />
      <AppText color="secondary" variant="caption">
        Each transfer-in row on the new passbook, usually the balance first and the interest later. A credit dated before the claim counts in the new account from that date.
      </AppText>
      {draft.credits.map((credit, index) => (
        <View key={index} style={styles.credit} testID={`epf-claim-credit-${index}`}>
          <AppText weight="bold">Credit {index + 1}</AppText>
          <DatePickerField error={errors[claimCreditField(index, "Date")]}
            fieldRef={(node) => registerField(claimCreditField(index, "Date"), node)}
            label="Credited on" maximumDate={now} onChange={(value) => setCredit(index, "date", value)}
            testID={`epf-claim-credit-${index}-date`} value={credit.date} />
          {text(claimCreditField(index, "Amount"), "Amount (INR)", `epf-claim-credit-${index}-amount-input`, credit.amount,
            (value) => setCredit(index, "amount", value))}
          {text(claimCreditField(index, "Employee"), "Employee part (optional)", `epf-claim-credit-${index}-employee-input`,
            credit.employee, (value) => setCredit(index, "employee", value))}
          {text(claimCreditField(index, "Employer"), "Employer part (optional)", `epf-claim-credit-${index}-employer-input`,
            credit.employer, (value) => setCredit(index, "employer", value))}
          {draft.credits.length > 1 ? (
            <AppButton onPress={() => update("credits", draft.credits.filter((_, position) => position !== index))}
              testID={`epf-claim-credit-${index}-remove`} title="Remove this credit" variant="ghost" />
          ) : null}
        </View>
      ))}
      {draft.credits.length < MAX_CLAIM_CREDITS ? (
        <AppButton onPress={() => update("credits", [...draft.credits, emptyClaimCredit(draft.credits.at(-1)?.date ?? draft.date)])}
          testID="epf-claim-add-credit" title="Add another credit" variant="secondary" />
      ) : null}
      <SelectionField label="Have all credits arrived?" onChange={(value) => update("transferStatus", value)}
        options={[{ label: "Yes, they add up to the claim", value: "completed" }, { label: "Not yet, more to come", value: "inTransit" }]}
        testIDPrefix="epf-claim-status" value={draft.transferStatus} />
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  credit: { gap: spacing.sm, paddingVertical: spacing.sm },
  error: { color: colors.loss },
}));
