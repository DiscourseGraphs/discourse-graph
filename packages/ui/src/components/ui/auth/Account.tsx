"use client";

import { useState, useEffect } from "react";
import { createClient } from "@repo/database/lib/client";
import type { Session } from "@supabase/auth-js";
import { Button } from "@repo/ui/components/ui/button";
import { SignUpForm } from "@repo/ui/components/ui/auth/SignUpForm";
import { LoginForm } from "@repo/ui/components/ui/auth/LoginForm";
import { ForgotPasswordForm } from "@repo/ui/components/ui/auth/ForgotPasswordForm";
import { UpdatePasswordForm } from "@repo/ui/components/ui/auth/UpdatePasswordForm";

// based on https://supabase.com/ui/docs/react/password-based-auth
// also see https://supabase.com/ui/docs/nextjs/password-based-auth

enum AuthAction {
  none,
  login,
  signup,
  forgotPassword,
  updatePassword,
}

export const Account = async () => {
  const [session, setSession] = useState<Session | null>(null);
  const [action, setAction] = useState(AuthAction.none);

  const supabase = createClient();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = await supabase.auth.getUser();
  if (!user) {
    setAction(AuthAction.login);
  }
  switch (action) {
    case AuthAction.none:
      return (
        <div>
          <p>Logged in!</p>
          <Button
            type="button"
            onClick={() => {
              setAction(AuthAction.updatePassword);
            }}
          >
            Reset password
          </Button>
        </div>
      );
    case AuthAction.login:
      return (
        <div>
          <LoginForm></LoginForm>
          <Button
            type="button"
            onClick={() => {
              setAction(AuthAction.signup);
            }}
          >
            Sign up
          </Button>
        </div>
      );
    case AuthAction.signup:
      return (
        <div>
          <SignUpForm></SignUpForm>
          <Button
            type="button"
            onClick={() => {
              setAction(AuthAction.login);
            }}
          >
            login
          </Button>
        </div>
      );
    case AuthAction.forgotPassword:
      return (
        <div>
          <ForgotPasswordForm></ForgotPasswordForm>
        </div>
      );
    case AuthAction.updatePassword:
      return (
        <div>
          <UpdatePasswordForm></UpdatePasswordForm>
        </div>
      );
  }
};
