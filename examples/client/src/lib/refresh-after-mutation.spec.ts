import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAfterMutation } from "./refresh-after-mutation";
import { toast } from "@/components/thread-ui/toast";

vi.mock("i18next", () => ({ t: (key: string) => key }));
vi.mock("@/components/thread-ui/toast", () => ({
  toast: { add: vi.fn(() => "warning"), close: vi.fn() },
}));

describe("refreshAfterMutation", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not warn after a successful refresh", async () => {
    await refreshAfterMutation(() => Promise.resolve());
    expect(toast.add).not.toHaveBeenCalled();
  });
  it("resolves a failed read and retries only that read", async () => {
    const mutation = vi.fn().mockResolvedValue(undefined);
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    await mutation();
    await expect(refreshAfterMutation(refresh)).resolves.toBeUndefined();
    const notification = vi.mocked(toast.add).mock.calls[0][0];
    expect(notification).toMatchObject({ type: "warning", timeout: 0 });
    notification.actionProps?.onClick?.({} as never);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(toast.close).toHaveBeenCalledWith("warning");
  });
});
