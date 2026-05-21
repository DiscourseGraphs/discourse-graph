import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import { removeFromGroup } from "~/utils/supabase/account";
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

  const spacesReq = await client.rpc("spaces_in_group", {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    p_group_id: groupId,
  });
  if (spacesReq.error) {
    internalError({ error: spacesReq.error });
    redirect(
      "/auth/error?error=" + encodeURIComponent("Could not load group members"),
    );
  }
  const spaces = spacesReq.data ?? [];

  let spaceToMember: Record<number, string> = {};
  if (isAdmin) {
    const pseudoReq = await client
      .from("my_pseudo_accounts")
      .select("dg_account,space_id");
    if (!pseudoReq.error && pseudoReq.data) {
      spaceToMember = Object.fromEntries(
        pseudoReq.data
          .filter((r) => r.dg_account !== null && r.space_id !== null)
          .map((r) => [r.space_id!, r.dg_account!]),
      );
    }
  }

  async function removeSpace(formData: FormData) {
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
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Member spaces</h2>
      {removeError && <p className="text-destructive text-sm">{removeError}</p>}
      {spaces.length === 0 ? (
        <p className="text-muted-foreground text-sm">No spaces yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {spaces.map((space) => {
            const memberId =
              space.id != null ? spaceToMember[space.id] : undefined;
            return (
              <li
                key={space.id}
                className="flex items-center justify-between px-4 py-2"
              >
                <span>
                  {space.name}
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({space.platform})
                  </span>
                  {space.admin && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                      admin
                    </span>
                  )}
                  {space.sharing_permissions ? (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                      {space.sharing_permissions}
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      not published
                    </span>
                  )}
                </span>
                {isAdmin && memberId && (
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
