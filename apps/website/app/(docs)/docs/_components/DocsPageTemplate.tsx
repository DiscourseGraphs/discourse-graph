import type { EvaluateResult } from "nextra";
import { useMDXComponents } from "mdx-components";
import { DocsPageHeading } from "./DocsPageHeading";

type DocsPageTemplateProps = Omit<EvaluateResult, "default"> & {
  children: ({
    h1,
  }: {
    h1: React.ComponentType<React.HTMLAttributes<HTMLHeadingElement>>;
  }) => React.ReactNode;
};

type DocsPageWrapperProps = Omit<DocsPageTemplateProps, "children"> & {
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
  const Wrapper = wrapper as React.ComponentType<DocsPageWrapperProps>;
  const H1 = h1 as React.ComponentType<
    React.HTMLAttributes<HTMLHeadingElement>
  >;
  const showsPrimaryHeading = hasPrimaryHeading(sourceCode);
  const PageHeading = (
    headingProps: React.HTMLAttributes<HTMLHeadingElement>,
  ): React.ReactElement =>
    DocsPageHeading({
      headingComponent: H1,
      headingProps,
      metadata,
    }) as unknown as React.ReactElement;

  return (
    <Wrapper metadata={metadata} sourceCode={sourceCode} {...wrapperProps}>
      {!showsPrimaryHeading && <PageHeading>{metadata.title}</PageHeading>}
      {children({ h1: PageHeading })}
    </Wrapper>
  );
};

export default DocsPageTemplate;
