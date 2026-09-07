import { getCalendarDatePart } from "@/src/domain/dates";
import { getOpeningPositionHistoryDate } from "@/src/domain/openingPositions";
import { isManualTrade } from "@/src/domain/transactionSemantics";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

import {
  analyseConviction,
  analysePatienceFromSells,
  analyseTradeFrequency,
  generateInsights,
  type AnalysisAvailability,
  type BehaviorInsight,
} from "./behaviorInsights";

export type InsightKind = BehaviorInsight["kind"];
export type InsightEvidenceRecord = {
  id: string;
  assetName: string;
  date: string | null;
  description: string;
};
export type BehaviorInsightDetail = {
  kind: InsightKind;
  title: string;
  availability: AnalysisAvailability;
  summary: string;
  period: string;
  facts: Array<{ label: string; value: number }>;
  methodology: string;
  limitation: string;
  records: InsightEvidenceRecord[];
};

export function getBehaviorInsightDetails({
  assets,
  trades,
  openingPositions,
  asOf,
}: {
  assets: Asset[];
  trades: Trade[];
  openingPositions: OpeningPosition[];
  asOf: string;
}): BehaviorInsightDetail[] {
  const names = new Map(assets.map((asset) => [asset.id, asset.name]));
  const eligible = (assetId: string, date: string | null) =>
    names.has(assetId) && (date === null || date <= asOf);
  const currentTrades = trades.filter((trade) =>
    eligible(trade.assetId, getCalendarDatePart(trade.date)),
  );
  const currentOpenings = openingPositions.filter((position) =>
    eligible(position.assetId, getOpeningPositionHistoryDate(position)),
  );
  const conviction = analyseConviction(currentTrades, currentOpenings);
  const patience = analysePatienceFromSells(currentTrades, currentOpenings);
  const frequency = analyseTradeFrequency({
    asOf,
    trades: currentTrades,
    openingPositions: currentOpenings,
  });
  const insights = generateInsights({ conviction, patience, frequency });
  const summary = (kind: InsightKind, fallback: string) =>
    insights.find((insight) => insight.kind === kind)?.summary ?? fallback;
  const tradeRecord = (
    trade: Trade,
    description: string,
  ): InsightEvidenceRecord => ({
    id: `trade:${trade.id}`,
    assetName: names.get(trade.assetId)!,
    date: getCalendarDatePart(trade.date),
    description,
  });
  const observedIds = new Set(patience.observedSaleIds);
  const details: BehaviorInsightDetail[] = [
    {
      kind: "conviction",
      title: "Conviction pattern",
      availability: conviction.availability,
      summary: summary(
        "conviction",
        `A pattern needs ${conviction.requiredDecisionCount} rated decisions. Ratings are optional; keep tracking as usual.`,
      ),
      period: `All retained decisions through ${asOf}`,
      facts: [
        { label: "Rated decisions", value: conviction.ratedDecisionCount },
        { label: "Without a rating", value: conviction.unratedDecisionCount },
        ...(conviction.availability === "available"
          ? [
              { label: "Rated 4-5", value: conviction.highCount },
              { label: "Rated 3", value: conviction.neutralCount },
              { label: "Rated 1-2", value: conviction.lowCount },
            ]
          : []),
      ],
      methodology:
        "Counts optional conviction ratings on recorded buys, sells and opening positions. Transfers do not contribute ratings.",
      limitation:
        "These are your recorded expectations, not a measure of investment quality or future returns. Missing ratings can change the picture.",
      records: [
        ...currentTrades
          .filter(isManualTrade)
          .filter((trade) => trade.conviction !== undefined)
          .map((trade) =>
            tradeRecord(
              trade,
              `${trade.type === "buy" ? "Buy" : "Sell"} · conviction ${trade.conviction}/5`,
            ),
          ),
        ...currentOpenings
          .filter((position) => position.conviction !== undefined)
          .map((position) => ({
            id: `opening:${position.id}`,
            assetName: names.get(position.assetId)!,
            date: getCalendarDatePart(position.date ?? ""),
            description: `Opening position · conviction ${position.conviction}/5`,
          })),
      ],
    },
    {
      kind: "patience",
      title: "Planned holding periods",
      availability: patience.availability,
      summary: summary(
        "patience",
        `A pattern needs ${patience.requiredSaleCount} sales matched to dated purchases with a holding plan. There is no need to sell to create an insight.`,
      ),
      period: `Retained purchase and sale history through ${asOf}`,
      facts: [
        { label: "Sales with planned lots", value: patience.observedSaleCount },
        { label: "Met or passed plan", value: patience.metPlanCount },
        { label: "Closed earlier", value: patience.closedEarlierCount },
        { label: "Mixed timing", value: patience.mixedOutcomeCount },
      ],
      methodology:
        "Matches sales to the oldest available units first, then compares elapsed days with the plan recorded on the purchase or opening position. Each eligible sale counts once; a sale can include mixed timings.",
      limitation:
        "Undated or unplanned units cannot establish a comparison. Transfers affect available units but are not sale observations. This does not explain why you sold, judge that decision, or determine tax treatment.",
      records: currentTrades
        .filter((trade) => observedIds.has(trade.id))
        .map((trade) => tradeRecord(trade, "Sale with planned lots")),
    },
    {
      kind: "frequency",
      title: "Trading frequency",
      availability: frequency.availability,
      summary: summary(
        "frequency",
        `This observation needs ${frequency.minimumObservableDays} days of recorded history. It will become available as that history grows, even without new transactions.`,
      ),
      period: `${frequency.windowStart} to ${frequency.windowEnd} · ${frequency.windowDays}-day window`,
      facts: [
        { label: "Observable days", value: frequency.observableDays },
        { label: "Buys", value: frequency.buyCount },
        { label: "Sells", value: frequency.sellCount },
        { label: "Active days", value: frequency.activeTradingDays },
      ],
      methodology:
        "Counts recorded buys and sells in the date window. Opening positions establish history coverage but are not transactions; transfers do not count as buys or sells.",
      limitation:
        "Recorded history may be incomplete. More or fewer transactions is not inherently better, and activity does not measure investment returns.",
      records: currentTrades
        .filter(isManualTrade)
        .filter((trade) => {
          const date = getCalendarDatePart(trade.date);
          return (
            date !== null &&
            date >= frequency.windowStart &&
            date <= frequency.windowEnd
          );
        })
        .map((trade) =>
          tradeRecord(trade, trade.type === "buy" ? "Buy" : "Sell"),
        ),
    },
  ];
  return details.map((detail) => ({
    ...detail,
    records: detail.records.sort(
      (a, b) =>
        (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id),
    ),
  }));
}
