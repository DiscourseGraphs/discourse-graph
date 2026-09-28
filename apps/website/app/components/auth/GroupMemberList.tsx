import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import {
  removeFromGroup,
  setGroupAdmin,
  getSessionBaseUserData,
} from "~/utils/supabase/account";
import { Button } from "@repo/ui/components/ui/button";
import { GroupAdminToggle } from "~/components/auth/GroupAdminToggle";
import { buildMemberRows } from "~/utils/groupMemberRows";
import type { MemberRow } from "~/utils/groupMemberRows";
import internalError from "~/utils/internalErrorSsr";

const AdminBadge = ({ className }: { className?: string }) => (
  <span
    className={`rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 ${className ?? ""}`}
  >
    admin
  </span>
);

const MemberName = ({ row }: { row: MemberRow }) => (
  <>
    {row.name}
    <span className="text-muted-foreground ml-2 text-xs">({row.platform})</span>
    {row.isMe && (
      <span className="ml-2 rounded bg-blue-300 px-1.5 py-0.5 text-xs text-blue-900">
        me
      </span>
    )}
  </>
);

const RemoveForm = ({
  memberId,
  removeSpace,
}: {
  memberId: string;
  removeSpace: (formData: FormData) => Promise<void>;
}) => (
  <form action={removeSpace}>
    <input type="hidden" name="memberId" value={memberId} />
    <Button type="submit" variant="destructive" size="sm">
      Remove
    </Button>
  </form>
);

export const GroupMemberList = async ({
  groupId,
  isAdmin,
  removeError,
  adminError,
}: {
  groupId: string;
  isAdmin: boolean;
  removeError?: string;
  adminError?: string;
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
  const adminCountReq = await client
    .from("group_membership")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("admin", true);

  if (adminCountReq.error) {
    internalError({ error: adminCountReq.error });
    redirect(
      "/auth/error?error=" + encodeURIComponent("Could not load group members"),
    );
  }

  const rows = buildMemberRows({
    pseudoAccounts: pseudoAccountReq.data ?? [],
    myUserId,
    isAdmin,
    numAdmins: adminCountReq.count ?? 0,
  });

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

  const setAdmin = async (memberId: string, admin: boolean) => {
    "use server";
    const c = await createClient();
    const error = await setGroupAdmin({ client: c, groupId, memberId, admin });
    if (error) {
      redirect(
        `/auth/group/${groupId}?adminError=` + encodeURIComponent(error),
      );
    }
    redirect(`/auth/group/${groupId}`);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Member spaces</h2>
      {removeError && <p className="text-destructive text-sm">{removeError}</p>}
      {adminError && <p className="text-destructive text-sm">{adminError}</p>}
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No spaces yet.</p>
      ) : isAdmin ? (
        <table className="w-full rounded-md border">
          <thead>
            <tr className="border-b text-left">
              <th className="w-full px-4 py-2 font-medium">Space</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Admin</th>
              <th className="whitespace-nowrap px-4 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-2">
                  <MemberName row={row} />
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {row.canSetAdmin && row.memberId ? (
                    <GroupAdminToggle
                      memberId={row.memberId}
                      memberName={row.name ?? row.platform ?? "this member"}
                      admin={row.admin}
                      setAdmin={setAdmin}
                    />
                  ) : (
                    row.admin && <AdminBadge />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  {row.canRemove && row.memberId && (
                    <RemoveForm
                      memberId={row.memberId}
                      removeSpace={removeSpace}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between px-4 py-2"
            >
              <span>
                <MemberName row={row} />
                {row.admin && <AdminBadge className="ml-2" />}
              </span>
              {row.canRemove && row.memberId && (
                <RemoveForm memberId={row.memberId} removeSpace={removeSpace} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
