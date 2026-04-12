import "~/(nextra)/nextra-css.css";
import "nextra-theme-docs/style-prefixed.css";

type BlogLayoutProps = {
  children: React.ReactNode;
};

const BlogLayout = ({ children }: BlogLayoutProps): React.ReactElement => (
  <div className="nextra-reset flex flex-1 flex-col">{children}</div>
);

export default BlogLayout;
