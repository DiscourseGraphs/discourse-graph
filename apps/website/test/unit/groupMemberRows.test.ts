import { describe, it, expect } from "vitest";
import type { Tables } from "@repo/database/dbTypes";
import { buildMemberRows } from "../../app/utils/groupMemberRows";

const ME = "uuid-me";
const OTHER = "uuid-other";

const pseudoAccount = ({
  memberId,
  admin,
  spaceId,
}: {
  memberId: string;
  admin: boolean;
  spaceId: number;
}): Tables<"my_pseudo_accounts"> => ({
  id: spaceId,
  platform: "Roam",
  dg_account: memberId,
  group_id: "uuid-group",
  admin,
  space_id: spaceId,
  name: `space-${spaceId}`,
  sharing_permissions: null,
});

const soleAdmin = [
  pseudoAccount({ memberId: ME, admin: true, spaceId: 1 }),
  pseudoAccount({ memberId: OTHER, admin: false, spaceId: 2 }),
];

const twoAdmins = [
  pseudoAccount({ memberId: ME, admin: true, spaceId: 1 }),
  pseudoAccount({ memberId: OTHER, admin: true, spaceId: 2 }),
];

describe("buildMemberRows", () => {
  it("offers no admin control to a non-admin viewer", () => {
    const rows = buildMemberRows({
      pseudoAccounts: soleAdmin,
      myUserId: OTHER,
      isAdmin: false,
      numAdmins: 1,
    });
    expect(rows.map((r) => r.canSetAdmin)).toEqual([false, false]);
  });

  it("lets a non-admin remove only their own membership", () => {
    const rows = buildMemberRows({
      pseudoAccounts: soleAdmin,
      myUserId: OTHER,
      isAdmin: false,
      numAdmins: 1,
    });
    expect(rows.map((r) => r.canRemove)).toEqual([false, true]);
  });

  it("withholds the control from the last admin", () => {
    const rows = buildMemberRows({
      pseudoAccounts: soleAdmin,
      myUserId: ME,
      isAdmin: true,
      numAdmins: 1,
    });
    expect(rows[0]).toMatchObject({
      isMe: true,
      admin: true,
      canSetAdmin: false,
    });
    expect(rows[1]).toMatchObject({ admin: false, canSetAdmin: true });
  });

  it("frees the guard for an admin who holds no listed space row", () => {
    const rows = buildMemberRows({
      pseudoAccounts: soleAdmin,
      myUserId: ME,
      isAdmin: true,
      // A person admin, who holds no space row and so is never listed.
      numAdmins: 2,
    });
    expect(rows[0]).toMatchObject({ admin: true, canSetAdmin: true });
  });

  it("lets either admin be demoted once there are two", () => {
    const rows = buildMemberRows({
      pseudoAccounts: twoAdmins,
      myUserId: ME,
      isAdmin: true,
      numAdmins: 2,
    });
    expect(rows.map((r) => r.canSetAdmin)).toEqual([true, true]);
  });

  it("keeps the sole admin from removing themselves", () => {
    const rows = buildMemberRows({
      pseudoAccounts: soleAdmin,
      myUserId: ME,
      isAdmin: true,
      numAdmins: 1,
    });
    expect(rows.map((r) => r.canRemove)).toEqual([false, true]);
  });

  it("frees the last-admin guards once a second admin exists", () => {
    const rows = buildMemberRows({
      pseudoAccounts: twoAdmins,
      myUserId: ME,
      isAdmin: true,
      numAdmins: 2,
    });
    expect(rows.map((r) => r.canRemove)).toEqual([true, true]);
  });

  it("offers nothing for a member with no account", () => {
    const rows = buildMemberRows({
      pseudoAccounts: [
        pseudoAccount({ memberId: ME, admin: true, spaceId: 1 }),
        {
          ...pseudoAccount({ memberId: OTHER, admin: true, spaceId: 2 }),
          dg_account: null,
        },
      ],
      myUserId: ME,
      isAdmin: true,
      numAdmins: 2,
    });
    expect(rows[1]).toMatchObject({ canRemove: false, canSetAdmin: false });
  });
});
