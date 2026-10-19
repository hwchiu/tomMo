import { describe, expect, it } from "vitest";
import { machineTypeNameError, machineTypeNameInvalid } from "./machine-type";

describe("machine type names", () => {
  it("accepts English names", () => {
    expect(machineTypeNameError("EIA-1")).toBeNull();
    expect(machineTypeNameError(" Rack_2.a ")).toBeNull();
  });

  it("rejects blank, non-English, and oversized names", () => {
    expect(machineTypeNameError("  ")).toBe("機種名稱必填");
    expect(machineTypeNameError("機種A")).toBe(machineTypeNameInvalid);
    expect(machineTypeNameError("1EIA")).toBe(machineTypeNameInvalid);
    expect(machineTypeNameError("this-name-is-longer-than-thirty-two-chars")).toBe(machineTypeNameInvalid);
  });
});
