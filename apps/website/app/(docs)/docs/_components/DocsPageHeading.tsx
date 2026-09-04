import React from "react";
import { getDocsPageDetails } from "../docsMetadata";

type DocsPageHeadingProps = {
  headingComponent: unknown;
  headingProps: unknown;
  metadata: Parameters<typeof getDocsPageDetails>[0];
};

const formatDate = (date: string): string =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(date));

export const DocsPageHeading = (
  props: DocsPageHeadingProps,
): React.ReactElement => {
  const { headingComponent, metadata } = props;
  const HeadingComponent = headingComponent as React.ElementType<
    React.HTMLAttributes<HTMLHeadingElement>
  >;
  const headingProps =
    props.headingProps as React.HTMLAttributes<HTMLHeadingElement>;
  const { author, publishedAt, updatedAt } = getDocsPageDetails(metadata);

  return (
    <>
      <HeadingComponent {...headingProps} />
      <p className="mt-2 text-sm text-gray-500">
        By {author}
        {publishedAt && (
          <>
            {" \u00b7 Published "}
            <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
          </>
        )}
        {updatedAt && (
          <>
            {" \u00b7 Updated "}
            <time dateTime={updatedAt}>{formatDate(updatedAt)}</time>
          </>
        )}
      </p>
    </>
  );
};
