"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import { Label as LabelPrimitive } from "@repo/ui/components/radix/react/label/label";
import { cn } from "@repo/ui/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled: cursor-not-allowed peer-disabled: opacity-70",
);

type LabelProps = React.HTMLAttributes<HTMLLabelElement> & {
  ref?: React.Ref<HTMLLabelElement>;
};

const Label = ({ className, ref, ...props }: LabelProps) => (
  <LabelPrimitive
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
);

export { Label };
