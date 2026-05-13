"use client";

import { createClient } from "~/utils/supabase/client";
import { getSessionUserData } from "~/utils/supabase/account";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Tables } from "@repo/database/dbTypes";
import useInternalError from "~/utils/internalError";

type GroupData = Tables<"my_groups">;

export const ListGroups = () => {
  const [groupData, setGroupData] = useState<GroupData[] | null>(null);
  const [adminData, setAdminData] = useState<Record<string, boolean>>({});
  const [userName, setUserName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const internalError = useInternalError();

  useEffect(() => {
    const getGroups = async () => {
      try {
        const client = createClient();
        const userData = await getSessionUserData(client);
        if (!userData) {
          const userMessage = "Not logged in.\nPlease log in from application.";
          setError(userMessage);
          return;
        }
        const { name, type, id } = userData;
        if (type === "anonymous") setUserName("Space " + name);
        else if (type === "group") setUserName("group " + name);
        else if (type === "person") setUserName(name);
        const groupResponse = await client.from("my_groups").select();
        if (groupResponse.error) {
          const userMessage = "Could not access DiscourseGraphs";
          setError(userMessage);
          internalError({
            error: groupResponse.error,
          });
          return;
        }
        setGroupData(groupResponse.data);
        const membershipReq = await client
          .from("group_membership")
          .select("group_id,admin")
          .eq("member_id", id);
        if (membershipReq.error) {
          const userMessage = "Could not access DiscourseGraphs";
          setError(userMessage);
          internalError({
            error: membershipReq.error,
          });
          return;
        }
        setAdminData(
          Object.fromEntries(
            // eslint-disable-next-line @typescript-eslint/naming-convention
            membershipReq.data.map(({ group_id, admin }) => [
              group_id,
              admin || false,
            ]),
          ),
        );
      } catch (error) {
        const userMessage = "Unknown error occurred";
        setError(userMessage);
        internalError({
          error,
        });
      }
    };
    void getGroups();
  }, [internalError]);

  return (
    <div>
      <div className="text-right text-sm">
        {userName ? <p>Logged in as {userName}</p> : ""}
      </div>
      <div>
        {error ? (
          "Error: " + error
        ) : groupData === null ? (
          "loading"
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
    </div>
  );
};
