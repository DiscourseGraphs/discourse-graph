import { LoginWithToken } from "~/components/auth/LoginWithToken";
import { Suspense } from "react";

const Page = () => (
  <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
    <Suspense fallback={<>Logging in</>}>
      <LoginWithToken />
    </Suspense>
  </div>
);

export default Page;
