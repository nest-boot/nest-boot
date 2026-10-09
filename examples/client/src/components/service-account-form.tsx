import { useId, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { graphql } from "@/gql";
import { MemberType } from "@/gql/graphql";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ADD_SERVICE_ACCOUNT = graphql(`
  mutation addServiceAccountFromMembersRoute($input: AddMemberInput!) {
    addMember(input: $input) {
      id
    }
  }
`);

/** Creates an automation identity, then opens its existing member editor. */
export function ServiceAccountForm({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const id = useId();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [addMember, { loading }] = useMutation(ADD_SERVICE_ACCOUNT);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("member:service_account.create")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          id={id}
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (loading || !name.trim()) return;
            setError(undefined);
            try {
              const result = await addMember({
                variables: {
                  input: {
                    type: MemberType.SERVICE_ACCOUNT,
                    name: name.trim(),
                  },
                },
              });
              const memberId = result.data?.addMember.id;
              if (!memberId)
                throw new Error(t("member:service_account.failed"));
              await navigate({
                to: "/workspaces/$workspaceId/members/$memberId",
                params: { workspaceId, memberId },
              });
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : t("member:service_account.failed"),
              );
            }
          }}
        >
          <Input
            id={`${id}-name`}
            label={t("member:table.name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            required
            disabled={loading}
            error={error}
          />
        </form>
      </CardContent>
      <CardFooter>
        <Button
          type="submit"
          form={id}
          disabled={loading || !name.trim()}
          loading={loading}
        >
          {t("action.create")}
        </Button>
      </CardFooter>
    </Card>
  );
}
