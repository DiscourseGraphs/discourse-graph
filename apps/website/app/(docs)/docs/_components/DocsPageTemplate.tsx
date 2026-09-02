import type { EvaluateResult } from "nextra";
import { useMDXComponents } from "mdx-components";
import { getDocsPageDetails } from "../docsMetadata";

type DocsPageTemplateProps = Omit<EvaluateResult, "default"> & {
  children: React.ReactNode;
};

const hasPrimaryHeading = (sourceCode: string): boolean =>
  /(^|\n)#\s+\S/m.test(sourceCode);

const DocsPageTemplate = ({
  children,
  metadata,
  sourceCode,
  ...wrapperProps
}: DocsPageTemplateProps): React.ReactElement => {
  const { h1, wrapper } = useMDXComponents();
  const Wrapper = wrapper as React.ComponentType<DocsPageTemplateProps>;
  const H1 = h1 as React.ComponentType<
    React.HTMLAttributes<HTMLHeadingElement> & {
      children: React.ReactNode;
    }
  >;
  const { author, updatedAt } = getDocsPageDetails(metadata);
  const showsPrimaryHeading = hasPrimaryHeading(sourceCode);

  return (
    <Wrapper metadata={metadata} sourceCode={sourceCode} {...wrapperProps}>
      {!showsPrimaryHeading && (
        <>
          <H1>{metadata.title}</H1>
          <p className="mt-2 text-sm text-gray-500">
            By {author}
            {updatedAt && (
              <>
                {" · Last updated "}
                <time dateTime={updatedAt}>
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "long",
                    timeZone: "UTC",
                  }).format(new Date(updatedAt))}
                </time>
              </>
            )}
          </p>
        </>
      )}
      {children}
    </Wrapper>
  );
};

export default DocsPageTemplate;
