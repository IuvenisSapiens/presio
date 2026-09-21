import { useEffect, useState } from "react";
import { getHighlighter } from "@/lib/highlighter";

type Lang = "typst" | "latex";

interface CodeBlockProps {
  code: string;
  lang?: Lang;
}

export function CodeBlock({ code, lang = "typst" }: CodeBlockProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    getHighlighter()
      .then((hl) =>
        hl.codeToHtml(code, {
          lang,
          themes: { light: "github-light", dark: "github-dark" },
          // Emit CSS variables so the `.dark` class swaps themes for us.
          defaultColor: false,
        })
      )
      .then((out) => {
        if (!cancelled) setHtml(out);
      })
      .catch((err) => {
        // Falls back to the plain <pre> below, which looks close enough to the
        // real thing that a total failure went unnoticed on deployed origins
        // (the CSP blocked Shiki's WebAssembly engine). Degrade quietly for the
        // user, but say so in the console.
        console.warn("Syntax highlighting unavailable, showing plain code:", err);
      });
    return () => { cancelled = true; };
  }, [code, lang]);

  // Until highlighting resolves (or if it fails), show the raw snippet so the
  // page never flashes empty.
  if (!html) {
    return (
      <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono whitespace-pre">
        {code}
      </pre>
    );
  }

  return (
    <div
      className="text-xs rounded-md overflow-x-auto border border-border [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
