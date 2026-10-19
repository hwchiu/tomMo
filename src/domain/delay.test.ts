import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { delayCatalog, delayReasons, type DelayInput, type DelayReason } from "./delay";

interface SharedFile {
  catalog: Array<{ code: string; label: string; explanation: string }>;
  cases: Array<{
    name: string;
    input: DelayInput;
    expect: Array<Pick<DelayReason, "code" | "label" | "kind" | "daysLate" | "ownerPersonId" | "ownerRole">>;
  }>;
}

const shared = JSON.parse(readFileSync(resolve(__dirname, "../../testdata/delay-cases.json"), "utf8")) as SharedFile;

describe("delay reasons", () => {
  it("matches the shared catalog", () => {
    expect(delayCatalog.map((item) => ({ code: item.code, label: item.label, explanation: item.explanation }))).toEqual(shared.catalog);
  });

  it.each(shared.cases)("$name", (tc) => {
    const got = delayReasons(tc.input).map((reason) => ({
      code: reason.code,
      label: reason.label,
      kind: reason.kind,
      daysLate: reason.daysLate,
      ownerPersonId: reason.ownerPersonId,
      ownerRole: reason.ownerRole,
    }));
    expect(got).toEqual(tc.expect);
    for (const reason of delayReasons(tc.input)) {
      expect(reason.explanation).toBe(delayCatalog.find((item) => item.code === reason.code)?.explanation);
    }
  });
});
