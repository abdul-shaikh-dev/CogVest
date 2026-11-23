/** A request for a holding's daily closing prices over a date range. */
export type DailyPriceRequest = {
  basis: "close" | "adjusted-close";
  currency: "INR" | "USD";
  from: string;
  provider: "yahoo" | "coingecko" | "amfi";
  providerId: string;
  to: string;
};

export type DailyPricePoint = { close: number; date: string };

/** A cached daily price history (#666: shared by the domain and the quote cache service). */
export type DailyPriceEntry = DailyPriceRequest & {
  complete: boolean;
  fetchedAt: string;
  points: DailyPricePoint[];
};
