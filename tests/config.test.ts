import { describe, expect, it } from "vitest";
import { parseBoolean, parsePositiveNumber } from "../src/config";

describe("config parsers", () => {
  it("parses boolean values", () => {
    expect(parseBoolean("true", false)).toBe(true);
    expect(parseBoolean("false", true)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
  });

  it("parses positive numbers", () => {
    expect(parsePositiveNumber("5000", 0)).toBe(5000);
    expect(parsePositiveNumber("0", 123)).toBe(123);
    expect(parsePositiveNumber("bad", 123)).toBe(123);
    expect(parsePositiveNumber(undefined, 123)).toBe(123);
  });
});
