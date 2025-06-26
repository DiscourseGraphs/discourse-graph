import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Label } from "@blueprintjs/core";
import { SignUpForm } from "./SignUpForm";
import { LoginForm } from "./LoginForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

// based on https://supabase.com/ui/docs/react/password-based-auth

enum AuthAction {
  waiting,
  loggedIn,
  login,
  signup,
  forgotPassword,
  updatePassword,
  emailSent,
}

export const Account = () => {
  const [action, setAction] = useState(AuthAction.waiting);

  const supabase = createClient();
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAction(AuthAction.loggedIn);
      else setAction(AuthAction.login);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setAction(AuthAction.loggedIn);
      else setAction(AuthAction.login);
    });

    return () => subscription.unsubscribe();
  }, []);

  switch (action) {
    case AuthAction.waiting:
      return (
        <div>
          <p>Checking...</p>
        </div>
      );
    case AuthAction.emailSent:
      return (
        <div>
          <p>An email was sent</p>
        </div>
      );
    case AuthAction.loggedIn:
      return (
        <div>
          <p>Logged in!</p>
          <Button
            type="button"
            onClick={() => {
              supabase.auth.signOut().then(() => {
                setAction(AuthAction.login);
              });
            }}
          >
            Log out
          </Button>
          <br />
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
          <LoginForm />
          <Button
            type="button"
            onClick={() => {
              setAction(AuthAction.signup);
            }}
          >
            Sign up
          </Button>
          <br />
          <Label htmlFor="login_to_forgot">Forgot your password?</Label>
          <Button
            id="login_to_forgot"
            type="button"
            onClick={() => {
              setAction(AuthAction.forgotPassword);
            }}
          >
            Reset password
          </Button>
        </div>
      );
    case AuthAction.signup:
      return (
        <div>
          <SignUpForm />
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
          <ForgotPasswordForm />
        </div>
      );
    case AuthAction.updatePassword:
      return (
        <div>
          <UpdatePasswordForm />
        </div>
      );
  }
};
