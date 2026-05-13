import { ListGroups } from "~/components/auth/ListGroups";
import { Suspense } from "react";

const Page = () => (
  <main>
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
      <Suspense fallback={<>Loading</>}>
        <ListGroups />
      </Suspense>
    </div>
  </main>
);

export default Page;
