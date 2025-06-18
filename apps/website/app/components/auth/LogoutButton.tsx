"use client";

import { createClient } from "~/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// based on https://supabase.com/ui/docs/nextjs/password-based-auth

export const LogoutButton = () => {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return <Button onClick={logout}>Logout</Button>;
};
