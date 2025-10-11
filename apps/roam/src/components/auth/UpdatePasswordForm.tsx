import { cn } from "@repo/ui/lib/utils";
import { createClient } from "@repo/database/lib/client";
import { Button, Card, InputGroup, Label } from "@blueprintjs/core";
import React, { useState } from "react";

// based on https://supabase.com/ui/docs/react/password-based-auth

export const UpdatePasswordForm = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Original: Update this route to redirect to an authenticated route. The user already has an active session.
      // TODO: Replacement action
      // location.href = "/protected";
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
            Reset Your Password
          </div>
          <div className={cn("text-muted-foreground text-sm", className)}>
            Please enter your new password below.
          </div>
        </div>
        <div className={cn("p-6 pt-0", className)}>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <InputGroup
                  id="password"
                  type="password"
                  placeholder="New password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save new password"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};
