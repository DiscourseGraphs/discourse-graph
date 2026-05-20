import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import { acceptGroupInvitation } from "~/utils/supabase/account";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

export const JoinGroup = async ({
  error,
  joined,
}: {
  error?: string;
  joined?: boolean;
}) => {
  async function joinGroup(formData: FormData) {
    "use server";
    const token = formData.get("token");
    if (typeof token !== "string" || !token.trim()) {
      redirect(
        "/auth/group?error=" + encodeURIComponent("Please enter a token"),
      );
    }
    const client = await createClient();
    const err = await acceptGroupInvitation(client, token.trim());
    if (err) {
      redirect("/auth/group?error=" + encodeURIComponent(err));
    }
    redirect("/auth/group?joined=1");
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Join a group</h2>
      {joined && (
        <p className="text-sm text-green-600">Successfully joined the group.</p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <form action={joinGroup} className="flex gap-2">
        <Input
          name="token"
          placeholder="Paste your invitation token"
          className="max-w-sm"
        />
        <Button type="submit">Join Group</Button>
      </form>
    </section>
  );
};
