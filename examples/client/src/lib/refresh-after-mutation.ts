import { t } from "i18next";
import { toast } from "@/components/thread-ui/toast";

/** A committed mutation must not be retried when only its follow-up read fails. */
export async function refreshAfterMutation(
  refresh: () => Promise<unknown>,
): Promise<void> {
  try {
    await refresh();
  } catch {
    const notification = toast.add({
      type: "warning",
      title: t("mutation.refresh_failed"),
      timeout: 0,
      actionProps: {
        children: t("action.retry"),
        onClick: () => {
          toast.close(notification);
          void refreshAfterMutation(refresh);
        },
      },
    });
  }
}
