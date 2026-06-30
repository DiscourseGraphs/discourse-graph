import { ListGroups } from "~/components/auth/ListGroups";
import { JoinGroup } from "~/components/auth/JoinGroup";
import { CreateGroup } from "~/components/auth/CreateGroup";

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    joined?: string;
    createError?: string;
    created?: string;
  }>;
}) => {
  const params = await searchParams;
  return (
    <main>
      <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        <ListGroups />
        <CreateGroup error={params.createError} created={params.created} />
        <JoinGroup error={params.error} joined={params.joined === "1"} />
      </div>
    </main>
  );
};

export default Page;
