import { useEffect, useState } from "react";
import { renderMarkdownHtml } from "../../markdown/html";
import { cx } from "../../ui/primitives";

/** Read-only rendered Markdown, used where text is shown but not edited. */
export function Preview({ source, className }: { source: string; className?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void renderMarkdownHtml(source).then((out) => {
      if (live) setHtml(out);
    });
    return () => {
      live = false;
    };
  }, [source]);
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: produced by rehype-sanitize
    <div className={cx("prose-md", className)} dangerouslySetInnerHTML={{ __html: html ?? "" }} />
  );
}
