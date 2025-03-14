import clsx from "clsx";

export function Prose<T extends React.ElementType = "div">({
  as,
  className,
  ...props
}: React.ComponentPropsWithoutRef<T> & {
  as?: T;
}) {
  let Component = as ?? "div";

  return (
    <Component
      className={clsx(
        className,
        "prose prose-slate dark:prose-invert max-w-none dark:text-slate-400",
        // headings
        "prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-[8.5rem]",
        // lead
        "prose-lead:text-slate-500 dark:prose-lead:text-slate-400",
        // links
        "prose-a:font-semibold dark:prose-a:text-sky-400",
        // pre
        "prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10",
        // hr
        "dark:prose-hr:border-slate-800",
      )}
      {...props}
    />
  );
}
