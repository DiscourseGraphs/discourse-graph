/**
 * Create a group and/or add member UUIDs to group_membership.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env (or environment)
 *
 * Usage:
 *   pnpm run create-group-and-members <groupName> [uuid1] [uuid2] ...
 *
 * - If the group already exists (by name: {name}@groups.discoursegraphs.com): adds the
 *   given UUIDs to group_membership. If a UUID is already in the group, it is ignored.
 * - If the group does not exist: creates it and adds the UUIDs (first one becomes admin).
 * - With an existing group, memberUids can be empty (no-op).
 * - When creating a new group, at least one member UUID is required.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "@repo/database/dbTypes";

dotenv.config();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (s: string): boolean => UUID_RE.test(s);

const parseArgs = (): { groupName: string; memberUids: string[] } => {
  const argv = process.argv.slice(2);
  const groupName = argv[0];
  const memberUids = argv.slice(1);

  if (!groupName) {
    console.error(
      "Usage: create-group-and-members <groupName> [uuid1] [uuid2] ...",
    );
    process.exit(1);
  }

  const invalid = memberUids.filter((u) => !isUuid(u));
  if (invalid.length > 0) {
    console.error("Invalid UUID(s):", invalid.join(", "));
    process.exit(1);
  }

  return { groupName, memberUids };
};

const groupEmail = (name: string): string =>
  `${name}@groups.discoursegraphs.com`;

const findExistingGroup = async (
  supabase: ReturnType<typeof createClient<Database, "public">>,
  groupName: string,
): Promise<{ id: string } | null> => {
  const email = groupEmail(groupName);
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Failed to list users:", error.message);
      process.exit(1);
    }

    const users = data?.users ?? [];
    const found = users.find((u) => u.email === email);
    if (found) return { id: found.id };

    if (users.length < perPage) return null;
    page += 1;
  }
};

const main = async (): Promise<void> => {
  const { groupName, memberUids } = parseArgs();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or environment",
    );
    process.exit(1);
  }

  const supabase = createClient<Database, "public">(url, serviceKey, {
    auth: { persistSession: false },
  });

  const existing = await findExistingGroup(supabase, groupName);
  console.log("existing", existing);
  let resolvedGroupId: string;
  let isNewGroup: boolean;

  if (existing) {
    resolvedGroupId = existing.id;
    isNewGroup = false;
    console.log("Using existing group:", resolvedGroupId, `(${groupName})`);
  } else {
    if (memberUids.length === 0) {
      console.error(
        "When creating a new group, provide at least one member UUID.",
      );
      process.exit(1);
    }

    const email = groupEmail(groupName);
    const password = crypto.randomUUID();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      role: "anon",
      user_metadata: { group: true },
      email_confirm: false,
    });

    if (error) {
      if ((error as { code?: string }).code === "email_exists") {
        console.error("A group with this name already exists:", email);
        process.exit(1);
      }
      console.error("Failed to create group user:", error.message);
      process.exit(1);
    }

    if (!data.user) {
      console.error("Failed to create group user: no user returned");
      process.exit(1);
    }

    resolvedGroupId = data.user.id;
    isNewGroup = true;
    console.log("Created group:", resolvedGroupId, `(${groupName})`);
  }

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < memberUids.length; i++) {
    const member_id = memberUids[i]!;
    const admin = isNewGroup && i === 0;

    const { error } = await supabase.from("group_membership").insert({
      group_id: resolvedGroupId,
      member_id,
      admin,
    });

    if (error) {
      if (error.code === "23505") {
        skipped += 1;
      } else {
        console.error("Failed to insert member", member_id, ":", error.message);
        process.exit(1);
      }
    } else {
      added += 1;
    }
  }

  console.log("Added", added, "member(s) to group_membership.");
  if (skipped > 0) {
    console.log("Skipped", skipped, "member(s) already in the group.");
  }
  if (isNewGroup && added > 0) {
    console.log("Admin:", memberUids[0]);
  }
};

main();
