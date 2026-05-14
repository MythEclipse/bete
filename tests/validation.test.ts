import { describe, expect, it } from "vitest";
import { validateUserStateUpdate } from "../src/validation";

describe("validateUserStateUpdate", () => {
  it("returns typed data for a valid user state update", async () => {
    const result = await validateUserStateUpdate({
      userId: "123",
      username: "aseph",
      avatar: "https://example.invalid/avatar.png",
      speaking: true,
    });

    expect(result).toEqual({
      userId: "123",
      username: "aseph",
      avatar: "https://example.invalid/avatar.png",
      speaking: true,
    });
  });

  it("returns null for non-object input", async () => {
    await expect(validateUserStateUpdate("bad")).resolves.toBeNull();
  });

  it("returns null for invalid field types", async () => {
    const result = await validateUserStateUpdate({
      userId: "123",
      username: "aseph",
      avatar: "https://example.invalid/avatar.png",
      speaking: "true",
    });

    expect(result).toBeNull();
  });
});
