/**
 * A recurring purchase (SIP) template (#766): an amount in INR bought on a day
 * of each month. A declaration only: nothing is recorded until the user
 * confirms an instalment, which records the same purchase as Record Purchase.
 */
export type SipTemplate = {
  id: string;
  assetId: string;
  amountInr: number;
  /** 1 to 31. In a shorter month the instalment falls on its last day. */
  dayOfMonth: number;
  /** The first month with an instalment, YYYY-MM. */
  startMonth: string;
  /**
   * "cash": paid from CogVest Cash, like Record Purchase.
   * "deposit": the money arrives from outside, so confirming also records a
   * matching Cash deposit on the same date.
   */
  funding: SipFunding;
  /** A paused template raises no new instalments. */
  paused: boolean;
  /** Months already confirmed or skipped, so they are not asked again. */
  handledMonths: SipHandledMonth[];
  createdAt: string;
  updatedAt: string;
};

export type SipFunding = "cash" | "deposit";

export type SipHandledMonth =
  | { month: string; status: "confirmed"; tradeId: string }
  | { month: string; status: "skipped" };
