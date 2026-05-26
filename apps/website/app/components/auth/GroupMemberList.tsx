import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import {
  removeFromGroup,
  getSessionBaseUserData,
} from "~/utils/supabase/account";
import { Button } from "@repo/ui/components/ui/button";
import internalError from "~/utils/internalErrorSsr";

export const GroupMemberList = async ({
  groupId,
  isAdmin,
  removeError,
}: {
  groupId: string;
  isAdmin: boolean;
  removeError?: string;
}) => {
  const client = await createClient();
  const clientData = await getSessionBaseUserData(client);
  const myUserId = clientData?.id;
  if (!myUserId) {
    internalError({ error: "Not logged in" });
    redirect(
      "/auth/error?error=" +
        encodeURIComponent("Not logged in.\nPlease log in from application."),
    );
  }

  const pseudoAccountReq = await client
    .from("my_pseudo_accounts")
    .select()
    .eq("group_id", groupId);

  if (pseudoAccountReq.error) {
    internalError({ error: pseudoAccountReq.error });
    redirect(
      "/auth/error?error=" + encodeURIComponent("Could not load group members"),
    );
  }
  const pseudoAccountInfo = pseudoAccountReq.data ?? [];
  const numAdmins = pseudoAccountInfo
    .map((pa) => (pa.admin ? 1 : 0) as number)
    .reduce((acc, cur) => acc + cur, 0);

  const removeSpace = async (formData: FormData) => {
    "use server";
    const memberId = formData.get("memberId");
    if (typeof memberId !== "string") return;
    const c = await createClient();
    const error = await removeFromGroup({ client: c, groupId, memberId });
    if (error) {
      redirect(
        `/auth/group/${groupId}?removeError=` + encodeURIComponent(error),
      );
    }
    redirect(`/auth/group/${groupId}`);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Member spaces</h2>
      {removeError && <p className="text-destructive text-sm">{removeError}</p>}
      {pseudoAccountInfo.length === 0 ? (
        <p className="text-muted-foreground text-sm">No spaces yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {pseudoAccountInfo.map((pseudoAccount) => {
            const memberId = pseudoAccount.dg_account;
            return (
              <li
                key={`${pseudoAccount.id}-${pseudoAccount.space_id}`}
                className="flex items-center justify-between px-4 py-2"
              >
                <span>
                  {pseudoAccount.name}
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({pseudoAccount.platform})
                  </span>
                  {pseudoAccount.dg_account === myUserId && (
                    <span className="ml-2 rounded bg-blue-300 px-1.5 py-0.5 text-xs text-blue-900">
                      me
                    </span>
                  )}
                  {pseudoAccount.admin && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                      admin
                    </span>
                  )}
                </span>
                {memberId &&
                  // allow admins to remove others
                  // admins should not remove self, unless there's another admin
                  ((isAdmin &&
                    (numAdmins > 1 || pseudoAccount.dg_account !== myUserId)) ||
                    // non-admins can remove self.
                    pseudoAccount.dg_account === myUserId) && (
                    <form action={removeSpace}>
                      <input type="hidden" name="memberId" value={memberId} />
                      <Button type="submit" variant="destructive" size="sm">
                        Remove
                      </Button>
                    </form>
                  )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
