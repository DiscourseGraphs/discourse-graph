import { cn } from "@repo/ui/lib/utils";
import { createClient } from "@repo/database/lib/client";
import { Button, Card, InputGroup, Label } from "@blueprintjs/core";
import React, { useState } from "react";

// based on https://supabase.com/ui/docs/react/password-based-auth

export const ForgotPasswordForm = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "http://localhost:3000/update-password",
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
              Check Your Email
            </div>
            <div className={cn("text-muted-foreground text-sm", className)}>
              Password reset instructions sent
            </div>
          </div>
          <div className={cn("p-6 pt-0", className)}>
            <p className="text-muted-foreground text-sm">
              If you registered using your email and password, you will receive
              a password reset email.
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
              Reset Your Password
            </div>
            <div className={cn("text-muted-foreground text-sm", className)}>
              Type in your email and we&apos;ll send you a link to reset your
              password
            </div>
          </div>
          <div className={cn("p-6 pt-0", className)}>
            <form onSubmit={handleForgotPassword}>
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
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send reset email"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
};
