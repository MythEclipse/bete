import { describe, expect, it, vi } from "vitest";
import { createBroadcaster } from "../../src/moderation/broadcaster";

function client() {
  return { readyState: 1, send: vi.fn() };
}

describe("createBroadcaster", () => {
  it("sends JSON events to open clients", () => {
    const ws = client();
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws as any);
    broadcaster.messageAnalyzed({ id: "m1", ai_status: "clean" } as any);

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: "message_analyzed",
      data: { id: "m1", ai_status: "clean" },
    });
  });

  it("skips closed clients", () => {
    const ws = { readyState: 3, send: vi.fn() };
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws as any);
    broadcaster.messageDeleted({ id: "m1", deleted_at: 123 });

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("broadcasts to multiple open clients", () => {
    const ws1 = client();
    const ws2 = client();
    const ws3 = client();
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws1 as any);
    broadcaster.addClient(ws2 as any);
    broadcaster.addClient(ws3 as any);

    broadcaster.messageCreated({
      id: "m1",
      content: "test",
    } as any);

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

    broadcaster.addClient(ws1 as any);
    broadcaster.addClient(ws2 as any);
    broadcaster.addClient(ws3 as any);

    broadcaster.messageUpdated({
      id: "m1",
      content: "updated",
    } as any);

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

    broadcaster.addClient(ws1 as any);
    expect(broadcaster.clientCount()).toBe(1);

    broadcaster.addClient(ws2 as any);
    expect(broadcaster.clientCount()).toBe(2);

    broadcaster.removeClient(ws1 as any);
    expect(broadcaster.clientCount()).toBe(1);

    broadcaster.removeClient(ws2 as any);
    expect(broadcaster.clientCount()).toBe(0);
  });

  it("payload includes numeric timestamp", () => {
    const ws = client();
    const broadcaster = createBroadcaster();

    broadcaster.addClient(ws as any);
    broadcaster.attachmentCreated({
      id: "a1",
      message_id: "m1",
    } as any);

    expect(ws.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(ws.send.mock.calls[0][0]);
    expect(payload.timestamp).toBeDefined();
    expect(typeof payload.timestamp).toBe("number");
    expect(payload.timestamp).toBeGreaterThan(0);
  });
});
