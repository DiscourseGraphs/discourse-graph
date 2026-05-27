"use client";
import { Button } from "@repo/ui/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const CopyButton = ({
  className,
  content,
}: {
  className?: string;
  content?: string;
}) => {
  const copyToken = () => {
    if (content) {
      toast("Copied to clipboard");
      void navigator.clipboard.writeText(content);
    }
  };
  return (
    <Button
      className={className}
      size="icon"
      variant="outline"
      onClick={copyToken}
      disabled={!content}
    >
      <Copy />
    </Button>
  );
};
