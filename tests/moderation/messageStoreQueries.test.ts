import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../../src/moderation/messageStore";

describe("message cursor helpers", () => {
  it("round-trips created_at and id", () => {
    const cursor = encodeCursor({ created_at: 1710000000000, id: "abc" });
    expect(decodeCursor(cursor)).toEqual({ created_at: 1710000000000, id: "abc" });
  });

  it("returns null for invalid cursor", () => {
    expect(decodeCursor("not-base64-json")).toBeNull();
  });
});
