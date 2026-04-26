export type CashEntryType = "addition" | "withdrawal";

export type CashEntry = {
  amount: number;
  date: string;
  id: string;
  institution?: string;
  label: string;
  notes?: string;
  type: CashEntryType;
};
