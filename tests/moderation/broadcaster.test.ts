import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import {
  type BroadcasterClient,
  createBroadcaster,
} from "../../src/moderation/broadcaster";
import type {
  AttachmentRecord,
  MessageRecord,
} from "../../src/moderation/types";

type TestClient = BroadcasterClient & { send: Mock };

function client(): TestClient {
  return { readyState: 1, send: vi.fn() };
}

function messageRecord(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: "m1",
    guild_id: "guild-1",
    channel_id: "channel-1",
    thread_id: null,
    user_id: "user-1",
    username: "alice",
    avatar_url: null,
    content: "test",
    edited_content: null,
    created_at: 1,
    edited_at: null,
    deleted_at: null,
    type: "text",
    metadata: null,
    ...overrides,
  };
}

function attachmentRecord(
  overrides: Partial<AttachmentRecord> = {},
): AttachmentRecord {
  return {
    id: "a1",
    message_id: "m1",
    guild_id: "guild-1",
    channel_id: "channel-1",
    thread_id: null,
    user_id: "user-1",
    filename: "image.png",
    size: 1,
    type: "image/png",
    discord_url: "https://example.com/image.png",
    uploaded_url: null,
    upload_status: "pending",
    upload_error: null,
    created_at: 1,
    uploaded_at: null,
    ...overrides,
  };
}

describe("createBroadcaster", () => {
  it("sends JSON events to open clients", () => {
    const ws = client();
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws);
    broadcaster.messageAnalyzed(messageRecord({ ai_status: "clean" }));

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: "message_analyzed",
      data: { id: "m1", ai_status: "clean" },
    });
  });

  it("skips closed clients", () => {
    const ws: TestClient = { readyState: 3, send: vi.fn() };
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws);
    broadcaster.messageDeleted({ id: "m1", deleted_at: 123 });

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("broadcasts to multiple open clients", () => {
    const ws1 = client();
    const ws2 = client();
    const ws3 = client();
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws1);
    broadcaster.addClient(ws2);
    broadcaster.addClient(ws3);

    broadcaster.messageCreated(messageRecord());

    expect(ws1.send).toHaveBeenCalledTimes(1);
    expect(ws2.send).toHaveBeenCalledTimes(1);
    expect(ws3.send).toHaveBeenCalledTimes(1);
  });

  it("failed send on one client does not prevent another client from receiving event", () => {
    const ws1 = client();
    const ws2 = client();
    const ws3 = client();
    const broadcaster = createBroadcaster();

    // ws1 throws on send
    ws1.send.mockImplementation(() => {
      throw new Error("Send failed");
    });

    broadcaster.addClient(ws1);
    broadcaster.addClient(ws2);
    broadcaster.addClient(ws3);

    broadcaster.messageUpdated({
      id: "m1",
      content: "updated",
    });

    // ws1 attempted send (threw)
    expect(ws1.send).toHaveBeenCalledTimes(1);
    // ws2 and ws3 should still receive the event
    expect(ws2.send).toHaveBeenCalledTimes(1);
    expect(ws3.send).toHaveBeenCalledTimes(1);
  });

  it("clientCount tracks add/remove", () => {
    const ws1 = client();
    const ws2 = client();
    const broadcaster = createBroadcaster();

    expect(broadcaster.clientCount()).toBe(0);

    broadcaster.addClient(ws1);
    expect(broadcaster.clientCount()).toBe(1);

    broadcaster.addClient(ws2);
    expect(broadcaster.clientCount()).toBe(2);

    broadcaster.removeClient(ws1);
    expect(broadcaster.clientCount()).toBe(1);

    broadcaster.removeClient(ws2);
    expect(broadcaster.clientCount()).toBe(0);
  });

  it("payload includes numeric timestamp", () => {
    const ws = client();
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws);
    broadcaster.attachmentCreated(attachmentRecord());

    expect(ws.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(ws.send.mock.calls[0][0]);
    expect(payload.timestamp).toBeDefined();
    expect(typeof payload.timestamp).toBe("number");
    expect(payload.timestamp).toBeGreaterThan(0);
  });
});
