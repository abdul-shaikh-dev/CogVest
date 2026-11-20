import { useMemo, useState } from "react";
import type { StoreApi } from "zustand/vanilla";

import { formatLocalCalendarDate } from "@/src/domain/dates";
import type { PassbookReadResult } from "@/src/domain/epf/passbook";
import { planPassbookImport } from "@/src/domain/epf/passbookImport";
import { mergePassbookImport, type PassbookBatchItem } from "@/src/domain/epf/passbookImportMerge";
import { usePortfolioFields } from "@/src/hooks";
import type { CasPdfSourceFile } from "@/src/services/import-export/casPdfExtraction";
import type { PortfolioStoreState } from "@/src/store";
import { createId } from "@/src/utils";
import { applyEpfChange } from "../epf/epfChange";
import {
  buildAssignment,
  defaultChoice,
  groupPassbooks,
  reviewImport,
  type MemberChoice,
  type PickedPassbook,
} from "./epfPassbookImportViewModel";

export type PickedPassbookFile = CasPdfSourceFile & { name: string };

export type EpfPassbookImportDeps = {
  now: Date;
  store: StoreApi<PortfolioStoreState>;
  pickPassbooks: () => Promise<PickedPassbookFile[]>;
  readPassbook: (source: CasPdfSourceFile) => Promise<PassbookReadResult>;
};

type Review = {
  view: ReturnType<typeof reviewImport>;
  changes: PassbookBatchItem[];
  commandId: string;
  revision: string;
  firstAccountId: string;
};

export function useEpfPassbookImport({ now, store, pickPassbooks, readPassbook }: EpfPassbookImportDeps) {
  const snapshot = usePortfolioFields(store, ["epf", "preferences"]);
  const today = formatLocalCalendarDate(now);
  const [files, setFiles] = useState<PickedPassbook[]>([]);
  const [choices, setChoices] = useState<Record<string, MemberChoice>>({});
  // A new account keeps its ID across reviews, so a retried save is the same command.
  const [newIds, setNewIds] = useState<Record<string, string>>({});
  const [choiceErrors, setChoiceErrors] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<Review>();
  const [saveError, setSaveError] = useState("");
  const grouped = useMemo(() => groupPassbooks(files), [files]);

  async function addFiles() {
    setProblems([]);
    let picked: PickedPassbookFile[];
    try {
      picked = await pickPassbooks();
    } catch {
      setProblems(["The files could not be opened. Try choosing them again."]);
      return;
    }
    if (!picked.length) return;
    setReading(true);
    const read: PickedPassbook[] = [];
    // One at a time: each read copies the PDF to the cache and removes it.
    for (const file of picked) read.push({ key: createId("passbook"), name: file.name, result: await readPassbook(file) });
    setReading(false);
    setFiles((current) => [...current, ...read]);
    setNewIds((current) => {
      const next = { ...current };
      for (const file of read) if (file.result.ok) next[file.result.passbook.memberId] ??= createId("epf");
      return next;
    });
  }

  function removeFile(key: string) {
    setFiles((current) => current.filter((file) => file.key !== key));
    setProblems([]);
  }

  function choose(memberId: string, patch: Partial<MemberChoice>) {
    const group = grouped.groups.find((item) => item.memberId === memberId);
    if (!group) return;
    setChoices((current) => ({ ...current, [memberId]: { ...(current[memberId] ?? defaultChoice(group)), ...patch } }));
    setChoiceErrors((current) => {
      const next = { ...current };
      delete next[memberId];
      return next;
    });
  }

  function startReview() {
    setProblems([]);
    setSaveError("");
    const accounts = snapshot.epf.accounts;
    const assigned = buildAssignment(grouped.groups, choices, newIds, accounts);
    if (!assigned.ok) { setChoiceErrors(assigned.errors); return; }
    const plan = planPassbookImport(grouped.passbooks, assigned.assignment, { now, today });
    if (!plan.ok) { setProblems(plan.errors); return; }
    const saved = { accounts: snapshot.epf.accounts, events: snapshot.epf.events };
    const merge = mergePassbookImport(saved, plan.plan, today);
    if (!merge.ok) { setProblems(merge.conflicts); return; }
    setReview({ view: reviewImport(saved, plan.plan, merge, today), changes: merge.changes, commandId: createId("epf-import"),
      revision: store.getState().getBackupRevision(), firstAccountId: plan.plan.accounts.at(-1)!.id });
  }

  function save(onComplete: (accountId: string) => void) {
    if (!review || review.changes.length === 0) return;
    const failure = applyEpfChange(store, { commandId: review.commandId, reason: "Import EPFO passbooks",
      change: { type: "batch", changes: review.changes } }, review.revision);
    if (failure) setSaveError(failure);
    else onComplete(review.firstAccountId);
  }

  return {
    accounts: snapshot.epf.accounts,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    files, grouped, choices, choiceErrors, problems, reading, review, saveError,
    addFiles, removeFile, choose, startReview, save,
    closeReview: () => { setReview(undefined); setSaveError(""); },
  };
}
