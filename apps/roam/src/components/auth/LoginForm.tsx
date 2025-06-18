import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, InputGroup, Label } from "@blueprintjs/core";
import React, { useState } from "react";

// based on https://supabase.com/ui/docs/react/password-based-auth

export const LoginForm = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Original: Update this route to redirect to an authenticated route. The user already has an active session.
      // TODO: Replacement action
      // location.href = '/protected'
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <div className={cn("flex flex-col space-y-1.5 p-6", className)}>
          <div
            className={cn(
              "text-2xl font-semibold leading-none tracking-tight",
              className,
            )}
          >
            Login
          </div>
          <div className={cn("text-muted-foreground text-sm", className)}>
            Enter your email below to login to your account
          </div>
        </div>
        <div className={cn("p-6 pt-0", className)}>
          <form onSubmit={handleLogin}>
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
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <a href="/sign-up" className="underline underline-offset-4">
                Sign up
              </a>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
