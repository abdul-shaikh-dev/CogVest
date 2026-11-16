import { getCalendarDatePart } from "@/src/domain/dates";
import type { ImportedTransactionProvenance } from "@/src/types";

import { zerodhaTradebookSourceFormat } from "./zerodhaTradebook";

type IdentityProvenance = Pick<ImportedTransactionProvenance,
  "account" | "externalId" | "sourceExchange" | "sourceExecutedAt" | "sourceFormat" | "sourceSegment">;

const normalize = (value?: string) => value?.trim().toUpperCase() ?? "";

/**
 * The key that makes an imported trade's external ID unique: its source
 * format, account and ID. A Zerodha `trade_id` is an exchange trade number,
 * which exchanges reuse across days and between NSE and BSE, so it is also
 * scoped by exchange, segment and execution date (#655). Every Zerodha import
 * has stored those three, so trades imported earlier are still recognised.
 * Undefined without an external ID.
 */
export function importExternalIdentityKey(provenance: IdentityProvenance) {
  if (!provenance.externalId?.trim()) return undefined;
  const scope = provenance.sourceFormat === zerodhaTradebookSourceFormat
    ? [
      normalize(provenance.sourceExchange),
      normalize(provenance.sourceSegment),
      getCalendarDatePart(provenance.sourceExecutedAt ?? "") ?? "",
    ].join("/")
    : "";
  return [provenance.sourceFormat, normalize(provenance.account), scope, normalize(provenance.externalId)].join("|");
}
