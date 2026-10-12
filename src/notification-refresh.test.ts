import { afterEach, describe, expect, it, vi } from "vitest";
import { watchNotifications, type NotificationClient } from "./notifications";

function connection() {
  let listener = () => {};
  const channel = {
    on: vi.fn(
      (
        _event: string,
        _filter: Record<string, string>,
        callback: () => void,
      ) => {
        listener = callback;
        return channel;
      },
    ),
    subscribe: vi.fn(() => channel),
  };
  const api = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => "ok"),
  };
  return { api, channel, changed: () => listener() };
}

afterEach(() => vi.useRealTimers());

describe("notification refresh lifecycle", () => {
  it("coalesces change bursts and isolates the owner", () => {
    vi.useFakeTimers();
    const { api, channel, changed } = connection();
    const callback = vi.fn();
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    const stop = watchNotifications(
      api as unknown as NotificationClient,
      "owner-id",
      callback,
      win,
      doc,
    );
    changed();
    changed();
    changed();
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        table: "notifications",
        filter: "user_id=eq.owner-id",
      }),
      expect.any(Function),
    );
    stop();
  });

  it("refreshes on reconnection and stops all work after teardown", () => {
    vi.useFakeTimers();
    const { api, channel, changed } = connection();
    const callback = vi.fn();
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: "hidden" });
    const stop = watchNotifications(
      api as unknown as NotificationClient,
      "owner",
      callback,
      win,
      doc,
    );
    doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(300);
    expect(callback).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    win.dispatchEvent(new Event("online"));
    doc.visibilityState = "hidden";
    vi.advanceTimersByTime(300);
    expect(callback).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);
    changed();
    stop();
    win.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(90_000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(api.removeChannel).toHaveBeenCalledWith(channel);
  });
});
