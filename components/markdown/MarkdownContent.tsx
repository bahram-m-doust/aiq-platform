"use client";

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

// Shared markdown renderer used everywhere a deliverable is shown. `dir="auto"`
// on every block lets Persian (RTL) and English (LTR) — often mixed in the same
// document — each lay out correctly without a global direction toggle.
const components = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      dir="auto"
      {...props}
      className="mt-8 mb-3 text-2xl font-semibold tracking-tight text-foreground first:mt-0"
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      dir="auto"
      {...props}
      className="mt-7 mb-2.5 text-xl font-semibold tracking-tight text-foreground first:mt-0"
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      dir="auto"
      {...props}
      className="mt-6 mb-2 text-lg font-semibold text-foreground first:mt-0"
    />
  ),
  h4: (props: ComponentPropsWithoutRef<"h4">) => (
    <h4
      dir="auto"
      {...props}
      className="mt-5 mb-2 text-base font-semibold text-foreground first:mt-0"
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p dir="auto" {...props} className="my-3 leading-7 text-foreground/90" />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      dir="auto"
      {...props}
      className="my-3 list-disc space-y-1.5 ps-6 text-foreground/90"
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      dir="auto"
      {...props}
      className="my-3 list-decimal space-y-1.5 ps-6 text-foreground/90"
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li {...props} className="leading-7" />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a
      {...props}
      className="font-medium text-primary underline underline-offset-2"
      rel="noopener noreferrer"
      target="_blank"
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong {...props} className="font-semibold text-foreground" />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      dir="auto"
      {...props}
      className="my-4 border-s-2 border-border ps-4 text-muted-foreground italic"
    />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr {...props} className="my-6 border-border" />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      {...props}
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      dir="ltr"
      {...props}
      className="my-4 overflow-x-auto rounded-lg bg-muted p-4 text-[0.85em]"
    />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-4 overflow-x-auto">
      <table
        {...props}
        className="w-full border-collapse text-sm [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-semibold"
      />
    </div>
  ),
};

export function MarkdownContent({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <div className={cn("text-[15px]", className)}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
