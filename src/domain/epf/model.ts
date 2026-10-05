import { z } from "zod";

import { getCalendarDatePart } from "@/src/domain/dates";
import { decimal } from "@/src/domain/precision";

const id = z.string().min(1).refine((value) => value === value.trim(), "Remove surrounding whitespace.");
export const epfDateSchema = z.string().refine(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && getCalendarDatePart(value) === value,
  "Use a valid calendar date.",
);
const money = z.number().finite().nonnegative().refine(
  (value) => Number.isSafeInteger(decimal(value).times(100).toNumber()),
  "Use an exact INR amount with at most two decimal places.",
);
const timestamp = z.string().datetime({ offset: true });

export const epfBalanceSchema = z.object({
  total: money,
  components: z.object({ employee: money, employer: money }).strict().nullable(),
}).strict().refine(
  ({ total, components }) => !components || decimal(components.employee)
    .plus(components.employer).equals(total),
  "Employee and employer balances must equal the total.",
);

export const epfAccountSchema = z.object({
  id,
  nickname: id,
  provider: z.enum(["epfo", "employerTrust"]),
  employerLabel: id.optional(),
  status: z.enum(["active", "inactive", "transferred", "closed"]),
  currency: z.literal("INR"),
  checkpoint: z.object({
    date: epfDateSchema,
    balance: epfBalanceSchema,
    // Null is unknown, not zero and not the opening account value.
    capital: money.nullable(),
    source: z.enum(["epfoStatement", "trustStatement", "userConfirmed"]),
    recordedAt: timestamp,
  }).strict(),
  historyCompleteThrough: epfDateSchema.nullable(),
}).strict().refine(
  (account) => account.historyCompleteThrough === null ||
    account.historyCompleteThrough >= account.checkpoint.date,
  "History coverage cannot precede the checkpoint.",
);

const base = {
  id,
  recordedAt: timestamp,
  effectiveDate: epfDateSchema,
  postedDate: epfDateSchema,
  evidence: id,
};
const accountEvent = { ...base, accountId: id };
export const epfEventSchema = z.discriminatedUnion("type", [
  z.object({ ...accountEvent, type: z.literal("contribution"),
    party: z.enum(["employee", "employer"]), amount: money,
    voluntary: z.boolean().optional(),
    wageMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  }).strict(),
  z.object({ ...accountEvent, type: z.literal("interest"), amount: epfBalanceSchema,
  }).strict(),
  z.object({ ...accountEvent, type: z.literal("withdrawal"), amount: epfBalanceSchema,
    capitalReduction: money.nullable(),
    destination: z.enum(["external", "unknown"]),
  }).strict(),
  z.object({ ...accountEvent, type: z.literal("externalTransferIn"),
    amount: epfBalanceSchema, capital: money.nullable(),
  }).strict(),
  z.object({ ...accountEvent, type: z.literal("reconciliation"),
    balance: epfBalanceSchema, capital: money.nullable(), reason: id,
  }).strict(),
  z.object({ ...accountEvent, type: z.literal("reversal"), reversesId: id, reason: id,
  }).strict(),
  // One record owns both legs. There are no independently editable transfer rows.
  z.object({ ...base, type: z.literal("transfer"), sourceId: id, destinationId: id,
    amount: epfBalanceSchema, capital: money.nullable(),
    status: z.enum(["requested", "inTransit", "completed"]),
    creditDate: epfDateSchema.nullable(),
  }).strict(),
]);

export const epfLedgerSchema = z.object({
  accounts: z.array(epfAccountSchema),
  events: z.array(epfEventSchema),
}).strict();

export type EpfBalance = z.infer<typeof epfBalanceSchema>;
export type EpfAccount = z.infer<typeof epfAccountSchema>;
export type EpfEvent = z.infer<typeof epfEventSchema>;
export type EpfLedger = z.infer<typeof epfLedgerSchema>;
