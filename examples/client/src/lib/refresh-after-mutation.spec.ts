import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { refreshAfterMutation } from "./refresh-after-mutation";

vi.mock("i18next", () => ({ t: (key: string) => key }));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(() => 1), dismiss: vi.fn() },
}));

describe("refreshAfterMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves successful refreshes silent", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await refreshAfterMutation(refresh);
    expect(refresh).toHaveBeenCalledOnce();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("offers a read-only retry without rejecting the committed operation", async () => {
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(undefined);
    await expect(refreshAfterMutation(refresh)).resolves.toBeUndefined();
    const options = vi.mocked(toast.warning).mock.calls[0][1]!;
    expect(options.duration).toBe(Infinity);
    expect(options.action).toEqual(
      expect.objectContaining({ label: "action.retry" }),
    );
    if (
      options.action &&
      typeof options.action === "object" &&
      "onClick" in options.action
    )
      options.action.onClick({} as never);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(toast.dismiss).toHaveBeenCalledWith(1);
    expect(toast.warning).toHaveBeenCalledOnce();
  });

  it("keeps failed retries recoverable", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("Offline"));
    await refreshAfterMutation(refresh);
    const action = vi.mocked(toast.warning).mock.calls[0][1]!.action;
    if (action && typeof action === "object" && "onClick" in action)
      action.onClick({} as never);
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalledTimes(2));
  });
});
