"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Shows Markdown safely: raw HTML inside a note is NOT rendered (react-markdown escapes it) and unsafe links
// such as javascript: are removed. Supports headings, lists, task lists ([ ] / [x]), tables, code and quotes.
export default function NoteMarkdown({ source }: { source: string }) {
  if (!source.trim()) return <p className="hint">Nothing to preview yet.</p>;
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
