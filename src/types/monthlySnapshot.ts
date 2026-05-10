export type MonthlySnapshot = {
  cashValue: number;
  cryptoValue: number;
  debtValue: number;
  equityValue: number;
  id: string;
  investedValue: number;
  month: string;
  monthlyExpense?: number;
  monthlyInvestment: number;
  notes?: string;
  portfolioValue: number;
  salary: number;
};
