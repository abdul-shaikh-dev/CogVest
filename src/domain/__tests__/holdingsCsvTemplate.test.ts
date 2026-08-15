import { parseHoldingsCsv } from "@/src/domain/holdingsCsv";
import {
  holdingsCsvTemplate,
  holdingsCsvTemplateFileName,
} from "@/src/domain/holdingsCsvTemplate";

describe("holdings CSV template", () => {
  it("is a valid two-row V1 import example", () => {
    expect(holdingsCsvTemplateFileName).toBe("cogvest-holdings-v1.csv");
    expect(
      parseHoldingsCsv(
        holdingsCsvTemplate,
        new Date("2026-08-15T12:00:00.000Z"),
      ),
    ).toMatchObject({ errors: [], rows: [{ rowNumber: 2 }, { rowNumber: 3 }] });
  });
});
