import { cn } from "@repo/ui/lib/utils";
import { createClient } from "@repo/database/lib/client";
import { Button, Card, InputGroup, Label } from "@blueprintjs/core";
import React, { useState } from "react";

// based on https://supabase.com/ui/docs/react/password-based-auth

export const SignUpForm = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <div className={cn("flex flex-col space-y-1.5 p-6", className)}>
            <div
              className={cn(
                "text-2xl font-semibold leading-none tracking-tight",
                className,
              )}
            >
              Thank you for signing up!
            </div>
            <div className={cn("text-muted-foreground text-sm", className)}>
              Check your email to confirm
            </div>
          </div>
          <div className={cn("p-6 pt-0", className)}>
            <p className="text-muted-foreground text-sm">
              You've successfully signed up. Please check your email to confirm
              your account before signing in.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className={cn("flex flex-col space-y-1.5 p-6", className)}>
            <div
              className={cn(
                "text-2xl font-semibold leading-none tracking-tight",
                className,
              )}
            >
              Sign up
            </div>
            <div className={cn("text-muted-foreground text-sm", className)}>
              Create a new account
            </div>
          </div>
          <div className={cn("p-6 pt-0", className)}>
            <form onSubmit={handleSignUp}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <InputGroup
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <InputGroup
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="repeat-password">Repeat Password</Label>
                  </div>
                  <InputGroup
                    id="repeat-password"
                    type="password"
                    required
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating an account..." : "Sign up"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
};
