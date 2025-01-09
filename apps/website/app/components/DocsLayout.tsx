"use client";

import { Navigation, NavigationList } from "~/components/Navigation";
import Link from "next/link";
import clsx from "clsx";
import { Logo } from "./Logo";

function GitHubIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" />
    </svg>
  );
}

function Header() {
  return (
    <header
      className={clsx(
        "fixed left-0 right-0 top-0 z-50 flex flex-none flex-wrap items-center justify-between bg-white px-4 py-4 shadow-md shadow-slate-900/5 transition duration-500 dark:shadow-none sm:px-6 lg:px-8",
      )}
    >
      <div className="relative flex flex-grow basis-0 items-center">
        <Logo />
      </div>
      <div className="relative flex basis-0 justify-end gap-6 sm:gap-8 md:flex-grow">
        <Link
          href="https://github.com/DiscourseGraphs/discourse-graph"
          className="group"
          aria-label="GitHub"
        >
          <GitHubIcon className="h-6 w-6 fill-slate-400 group-hover:fill-slate-500 dark:group-hover:fill-slate-300" />
        </Link>
      </div>
    </header>
  );
}

export const customScrollbar =
  "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 dark:hover:[&::-webkit-scrollbar-thumb]:bg-slate-600";

export function Layout({
  children,
  navigationList,
}: {
  children: React.ReactNode;
  navigationList: NavigationList;
}) {
  return (
    <div className="flex w-full flex-col pt-[64px]">
      <Header />
      <div className="relative mx-auto flex w-full max-w-screen-2xl flex-auto justify-center sm:px-2 lg:px-8 xl:px-12">
        <div className="hidden lg:relative lg:block lg:flex-none">
          <div className="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden" />
          <div className="absolute bottom-0 right-0 top-16 hidden h-12 w-px bg-gradient-to-t from-slate-800 dark:block" />
          <div className="absolute bottom-0 right-0 top-28 hidden w-px bg-slate-800 dark:block" />
          <div
            className={`${customScrollbar} sticky top-[4.75rem] -ml-0.5 h-[calc(100vh-5rem)] w-64 overflow-y-auto overflow-x-hidden py-8 pl-0.5 pr-8 xl:w-72 xl:pr-16`}
          >
            <Navigation navigation={navigationList} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
