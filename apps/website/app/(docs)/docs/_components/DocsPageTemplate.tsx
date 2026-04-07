import type { EvaluateResult } from "nextra";
import { useMDXComponents } from "mdx-components";

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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const Wrapper = wrapper as React.ComponentType<DocsPageTemplateProps>;
  const H1 = h1 as React.ComponentType<
    React.HTMLAttributes<HTMLHeadingElement> & {
      children: React.ReactNode;
    }
  >;

  return (
    <Wrapper metadata={metadata} sourceCode={sourceCode} {...wrapperProps}>
      {!hasPrimaryHeading(sourceCode) && <H1>{metadata.title}</H1>}
      {children}
    </Wrapper>
  );
};

export default DocsPageTemplate;
