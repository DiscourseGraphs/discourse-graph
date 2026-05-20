import { createClient } from "~/utils/supabase/server";
import { getSessionUserData } from "~/utils/supabase/account";
import Link from "next/link";
import { Tables } from "@repo/database/dbTypes";
import internalError from "~/utils/internalErrorSsr";

type GroupData = Tables<"my_groups">;

export const ListGroups = async () => {
  let groupData: GroupData[] | null = null;
  let adminData: Record<string, boolean> = {};
  let userName: string | undefined;
  let error: string | undefined;

  try {
    const client = await createClient();
    const userData = await getSessionUserData(client);
    if (!userData) {
      throw new Error("Not logged in.\nPlease log in from application.");
    }
    const { name, type, id } = userData;
    if (type === "anonymous") userName = "Space " + name;
    else if (type === "group") userName = "group " + name;
    else if (type === "person") userName = name;
    const groupResponse = await client.from("my_groups").select();
    if (groupResponse.error) {
      internalError({
        error: groupResponse.error,
      });
      throw new Error("Could not access DiscourseGraphs");
    }
    groupData = groupResponse.data;
    const membershipReq = await client
      .from("group_membership")
      .select("group_id,admin")
      .eq("member_id", id);
    if (membershipReq.error) {
      internalError({
        error: membershipReq.error,
      });
      throw new Error("Could not access Discourse Graphs");
    }
    adminData = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/naming-convention
      membershipReq.data.map(({ group_id, admin }) => [
        group_id,
        admin || false,
      ]),
    );
  } catch (e) {
    error = e instanceof Error ? e.message : "An unknown error occured";
  }

  return (
    <>
      <div className="text-right text-sm">
        {userName ? <p>Logged in as {userName}</p> : ""}
      </div>
      <div>
        {error ? (
          "Error: " + error
        ) : groupData === null ? (
          "Error" // we should have had an error in that case
        ) : groupData.length === 0 ? (
          <p>You are not part of any group.</p>
        ) : (
          <>
            <p>Your groups:</p>
            <ul className="list-inside list-disc space-y-2">
              {groupData.map((d) => (
                <li key={d.id}>
                  {adminData[d.id || ""] ? (
                    <Link href={"group/" + d.id!}>{d.name}</Link>
                  ) : (
                    d.name
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
};
