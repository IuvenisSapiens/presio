import { useState } from "react";
import { stripAttachments } from "@/lib/stripAttachments";
import { renderAnnotatedPdf } from "@/lib/annotatedPdf";
import { hasAnyStrokes } from "@/lib/annotations";
import type { Deck } from "@/lib/deck";

export type DownloadMode = "everything" | "no-drawings" | "no-attachments";

// Shared download logic: assembles the requested PDF variant from the deck
// and hands it to the browser. Used by DownloadButton's split button and by the
// narrow-footer overflow menu. Lives here rather than beside the component so
// the component file only exports components (react-refresh).
export function useDeckDownload(deck: Deck) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDrawing = hasAnyStrokes(deck.annotations);
  const stem = (deck.filename || "slides").replace(/\.pdf$/i, "");

  const download = async (mode: DownloadMode) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let bytes = await deck.pdf.getData();
      let name = `${stem}.pdf`;
      if (mode === "no-attachments" && deck.hasAttachments) {
        bytes = await stripAttachments(bytes);
        name = `${stem}-no-attachments.pdf`;
      }
      if (mode !== "no-drawings" && hasDrawing) {
        bytes = await renderAnnotatedPdf(bytes, deck.annotations);
      }
      // Coerce to a plain ArrayBuffer slice so Blob's BlobPart typing is happy.
      const buf = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a tick before revoking; Safari has been finicky.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, hasDrawing, download };
}
