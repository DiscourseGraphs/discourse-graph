import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/utils/supabase/server";
import { getSessionBaseUserData } from "~/utils/supabase/account";
import { GroupMemberList } from "~/components/auth/GroupMemberList";
import { GroupInvite } from "~/components/auth/GroupInvite";
import internalError from "~/utils/internalErrorSsr";

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{
    token?: string;
    tokenError?: string;
    removeError?: string;
  }>;
}) => {
  const { groupId } = await params;
  const sp = await searchParams;

  const client = await createClient();
  const userData = await getSessionBaseUserData(client);
  if (!userData)
    redirect("/auth/error?error=" + encodeURIComponent("Not logged in"));

  const membershipReq = await client
    .from("group_membership")
    .select("admin")
    .eq("group_id", groupId)
    .eq("member_id", userData.id)
    .maybeSingle();
  if (membershipReq.error) {
    internalError({ error: membershipReq.error });
    redirect("/auth/error?error=" + encodeURIComponent("Could not load group"));
  }
  if (!membershipReq.data) notFound();
  const isAdmin = membershipReq.data.admin === true;

  const groupReq = await client
    .from("my_groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();
  if (groupReq.error) {
    internalError({ error: groupReq.error });
    redirect("/auth/error?error=" + encodeURIComponent("Could not load group"));
  }
  const groupName = groupReq.data?.name ?? groupId;

  return (
    <main>
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <Link href="/auth/group" className="float-right">
          Back to group page
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{groupName}</h1>
        </div>
        <GroupMemberList
          groupId={groupId}
          isAdmin={isAdmin}
          removeError={sp.removeError}
        />
        {isAdmin && (
          <GroupInvite
            groupId={groupId}
            token={sp.token}
            tokenError={sp.tokenError}
          />
        )}
      </div>
    </main>
  );
};

export default Page;
