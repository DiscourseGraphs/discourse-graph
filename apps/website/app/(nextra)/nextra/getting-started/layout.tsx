import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { getCanonicalMetadata, PUBLIC_STATIC_PATHS } from "~/seo";

export const metadata: Metadata = getCanonicalMetadata(
  PUBLIC_STATIC_PATHS.nextraGettingStarted,
);

const GettingStartedLayout = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => <>{children}</>;

export default GettingStartedLayout;
