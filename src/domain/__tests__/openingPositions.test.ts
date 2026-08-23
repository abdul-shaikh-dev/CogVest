import {
  getOpeningPositionAcquisitionDate,
  getOpeningPositionHistoryDate,
  isTransactionAfterOpeningCutover,
  isOpeningPositionEffective,
} from "@/src/domain/openingPositions";
import type { OpeningPosition } from "@/src/types";

const knownPosition: OpeningPosition = {
  assetId: "asset-1",
  averageCostPrice: 100,
  currentPrice: 120,
  date: "2024-04-15",
  id: "opening-known",
  quantity: 2,
};

const unknownPosition: OpeningPosition = {
  ...knownPosition,
  date: null,
  id: "opening-unknown",
  recordedAt: "2026-07-10T09:30:00.000Z",
  recordedOn: "2026-07-10",
};

describe("opening position dates", () => {
  it("keeps acquisition truth separate from historical visibility", () => {
    expect(getOpeningPositionAcquisitionDate(knownPosition)).toBe("2024-04-15");
    expect(getOpeningPositionHistoryDate(knownPosition)).toBe("2024-04-15");
    expect(getOpeningPositionAcquisitionDate(unknownPosition)).toBeNull();
    expect(getOpeningPositionHistoryDate(unknownPosition)).toBe("2026-07-10");
  });

  it("uses the persisted calendar boundary instead of recalculating it from timezone", () => {
    expect(
      getOpeningPositionHistoryDate({
        ...unknownPosition,
        recordedAt: "2026-07-31T20:00:00.000Z",
        recordedOn: "2026-08-01",
      }),
    ).toBe("2026-08-01");
  });

  it("only makes an unknown-date position effective at its recorded boundary", () => {
    expect(
      isOpeningPositionEffective(
        unknownPosition,
        new Date("2026-07-09T12:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      isOpeningPositionEffective(
        unknownPosition,
        new Date("2026-07-10T12:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("uses measured-as-of as the aggregate baseline boundary", () => {
    const measuredPosition = {
      ...knownPosition,
      measuredAsOf: "2025-03-31",
    };

    expect(getOpeningPositionAcquisitionDate(measuredPosition)).toBe(
      "2024-04-15",
    );
    expect(getOpeningPositionHistoryDate(measuredPosition)).toBe("2025-03-31");
    expect(
      isTransactionAfterOpeningCutover("2025-03-31", [measuredPosition]),
    ).toBe(false);
    expect(
      isTransactionAfterOpeningCutover("2025-04-01", [measuredPosition]),
    ).toBe(true);
  });
});
