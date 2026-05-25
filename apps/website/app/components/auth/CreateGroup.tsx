import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import { createGroup } from "~/utils/supabase/account";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

export const CreateGroup = ({
  error,
  created,
}: {
  error?: string;
  created?: string;
}) => {
  const createGroupAction = async (formData: FormData) => {
    "use server";
    const name = formData.get("name");
    if (typeof name !== "string" || !name.trim()) {
      redirect(
        "/auth/group?createError=" +
          encodeURIComponent("Please enter a group name"),
      );
    }
    const client = await createClient();
    const { groupId, error: err } = await createGroup(client, name.trim());
    if (err) {
      redirect("/auth/group?createError=" + encodeURIComponent(err));
    }
    if (!groupId) {
      redirect(
        "/auth/group?createError=" +
          encodeURIComponent("Failed to create group"),
      );
    }
    redirect("/auth/group?created=" + encodeURIComponent(groupId));
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Create a group</h2>
      {created && (
        <p className="text-sm text-green-600">Group created successfully.</p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <form
        action={(formData) => {
          void createGroupAction(formData);
        }}
        className="flex gap-2"
      >
        <Input name="name" placeholder="Group name" className="max-w-sm" />
        <Button type="submit">Create Group</Button>
      </form>
    </section>
  );
};
