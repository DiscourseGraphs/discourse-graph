import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import { createGroupInvitation } from "~/utils/supabase/account";
import { Button } from "@repo/ui/components/ui/button";

export const GroupInvite = ({
  groupId,
  token,
  tokenError,
}: {
  groupId: string;
  token?: string;
  tokenError?: string;
}) => {
  const createToken = async (formData: FormData) => {
    "use server";
    const admin = formData.get("admin") === "true";
    const client = await createClient();
    const t = await createGroupInvitation({ client, groupId, admin });
    if (!t) {
      redirect(
        `/auth/group/${groupId}?tokenError=` +
          encodeURIComponent("Could not create invitation token"),
      );
    }
    redirect(`/auth/group/${groupId}?token=` + encodeURIComponent(t));
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Invite to group</h2>
      {tokenError && <p className="text-destructive text-sm">{tokenError}</p>}
      {token && (
        <div className="bg-muted rounded-md border p-3 text-sm">
          <p className="mb-1 font-medium">Invitation token (valid 60 days):</p>
          <code className="break-all">{token}</code>
        </div>
      )}
      <div className="flex gap-2">
        <form action={createToken}>
          <input type="hidden" name="admin" value="false" />
          <Button type="submit" variant="outline">
            Create member token
          </Button>
        </form>
      </div>
    </section>
  );
};
