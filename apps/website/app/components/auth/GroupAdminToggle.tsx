"use client";
import { useOptimistic, useTransition } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";

export const GroupAdminToggle = ({
  memberId,
  memberName,
  admin,
  setAdmin,
}: {
  memberId: string;
  memberName: string;
  admin: boolean;
  setAdmin: (memberId: string, admin: boolean) => Promise<void>;
}) => {
  const [optimisticAdmin, setOptimisticAdmin] = useOptimistic(admin);
  const [isPending, startTransition] = useTransition();

  const toggle = (checked: boolean) => {
    startTransition(async () => {
      setOptimisticAdmin(checked);
      await setAdmin(memberId, checked);
    });
  };

  return (
    <Checkbox
      checked={optimisticAdmin}
      disabled={isPending}
      onCheckedChange={(checked) => toggle(checked === true)}
      aria-label={`Admin rights for ${memberName}`}
    />
  );
};
