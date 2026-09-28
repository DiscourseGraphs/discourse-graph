import type { Tables } from "@repo/database/dbTypes";

export type MemberRow = {
  key: string;
  memberId: string | null;
  name: string | null;
  platform: Tables<"my_pseudo_accounts">["platform"];
  isMe: boolean;
  admin: boolean;
  canRemove: boolean;
  // Rendered as a control where true and as a badge where false, so a
  // disabled checkbox never appears.
  canSetAdmin: boolean;
};

export const buildMemberRows = ({
  pseudoAccounts,
  myUserId,
  isAdmin,
  // Over the whole membership, not over pseudoAccounts: a person member holds
  // no space row but can be an admin.
  numAdmins,
}: {
  pseudoAccounts: Tables<"my_pseudo_accounts">[];
  myUserId: string;
  isAdmin: boolean;
  numAdmins: number;
}): MemberRow[] =>
  pseudoAccounts.map((pseudoAccount) => {
    const memberId = pseudoAccount.dg_account;
    const isMe = memberId === myUserId;
    const admin = pseudoAccount.admin === true;
    return {
      key: `${pseudoAccount.id}-${pseudoAccount.space_id}`,
      memberId,
      name: pseudoAccount.name,
      platform: pseudoAccount.platform,
      isMe,
      admin,
      canRemove:
        memberId !== null &&
        // allow admins to remove others
        // admins should not remove self, unless there's another admin
        ((isAdmin && (numAdmins > 1 || !isMe)) ||
          // non-admins can remove self, scoped so it cannot override the
          // last-admin guard above.
          (!isAdmin && isMe)),
      // Keeps the UI from leaving a group with no admin. Not enforced below
      // this: RLS accepts a self-demotion by the last admin.
      canSetAdmin: memberId !== null && isAdmin && (numAdmins > 1 || !admin),
    };
  });
