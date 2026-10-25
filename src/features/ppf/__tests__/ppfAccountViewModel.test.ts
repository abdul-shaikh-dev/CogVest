import { readFileSync } from "fs";
import { join } from "path";

import {
  entryLabel,
  ppfAccountErrorFields,
  statusLabel,
  statusOptions,
} from "@/src/features/ppf/ppfAccountViewModel";

describe("PPF account labels", () => {
  it("labels every account status", () => {
    for (const option of statusOptions) {
      expect(statusLabel(option.value)).toBe(option.label);
    }
    expect(statusLabel("extendedWithContributions")).toBe("Extended with contributions");
  });

  it("labels ledger entries in user language", () => {
    expect(entryLabel("contribution")).toBe("Contribution");
    expect(entryLabel("withdrawal")).toBe("Withdrawal");
    expect(entryLabel("interestCredit")).toBe("Official interest");
    expect(entryLabel("reconciliation")).toBe("Balance correction");
  });
});

describe("PPF validation messages", () => {
  // The form routes each validator message to its field by exact text, so a
  // reworded message would silently fall back to the global error.
  it("maps only messages the validator actually produces", () => {
    const validator = readFileSync(
      join(__dirname, "../../../domain/ppf/validation.ts"),
      "utf8",
    );
    for (const message of Object.keys(ppfAccountErrorFields)) {
      expect(validator).toContain(JSON.stringify(message));
    }
  });
});
