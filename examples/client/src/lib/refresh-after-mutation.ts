import { t } from "i18next";
import { toast } from "sonner";

/** A committed mutation must not be retried when only its follow-up read fails. */
export async function refreshAfterMutation(
  refresh: () => Promise<unknown>,
): Promise<void> {
  try {
    await refresh();
  } catch {
    const notification = toast.warning(t("mutation.refresh_failed"), {
      duration: Infinity,
      action: {
        label: t("action.retry"),
        onClick: () => {
          toast.dismiss(notification);
          void refreshAfterMutation(refresh);
        },
      },
    });
  }
}
