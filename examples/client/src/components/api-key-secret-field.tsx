import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Field, FieldLabel } from "./ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./ui/input-group";
import { toast } from "./thread-ui/toast";

interface ApiKeySecretFieldProps {
  id: string;
  secret?: string;
  start?: string | null;
  prefix?: string | null;
}

/** Reveals a creation secret once; ordinary metadata only renders its masked prefix. */
export function ApiKeySecretField({
  id,
  secret,
  start,
  prefix,
}: ApiKeySecretFieldProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const keyStart = start || prefix;
  return (
    <Field data-disabled={!secret}>
      <FieldLabel htmlFor={id}>{t("api-key:table.key_start")}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          value={secret ?? (keyStart ? `${keyStart}...` : "—")}
          disabled={!secret}
          readOnly
        />
        {secret && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t(
                copied ? "api-key:created.copied" : "api-key:created.copy",
              )}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret);
                  setCopied(true);
                } catch {
                  toast.add({
                    type: "error",
                    title: t("api-key:created.copy_failed"),
                  });
                }
              }}
            >
              {copied ? <Check /> : <Copy />}
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </Field>
  );
}
