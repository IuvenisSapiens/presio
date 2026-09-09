import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The "1 / 12" slide counter, with the current page as an editable field so
// clicking it jumps. Chrome-free at rest so it still reads as plain text; the
// hover tint + text cursor are the only hints that it's editable.
export function SlideCounter({
  currentSlide,
  totalSlides,
  onGoTo,
  pendingJump = null,
  className,
}: {
  currentSlide: number;
  totalSlides: number;
  onGoTo: (slide: number) => void;
  /** Digits typed so far in the keyboard jump mode, shown in place of the page. */
  pendingJump?: string | null;
  className?: string;
}) {
  // null while the presenter isn't typing, so at rest the field simply follows
  // the deck (Next/Prev, remote jumps) with no state to keep in sync.
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs, and a blur normally commits — this tells the blur to skip it.
  const cancelled = useRef(false);

  const commit = (value: string | null) => {
    const n = value === null ? NaN : parseInt(value, 10);
    // Junk or an unchanged page is a no-op: don't broadcast a slide change.
    if (Number.isFinite(n) && n !== currentSlide) {
      onGoTo(Math.min(Math.max(n, 1), totalSlides));
    }
  };

  // Digits only, and never longer than the deck's page count needs.
  const maxLen = String(totalSlides).length;
  const shown = pendingJump ?? draft ?? String(currentSlide);

  return (
    <span className={cn("text-sm font-medium tabular-nums", className)}>
      {pendingJump !== null && <span className="text-primary mr-1">Jump</span>}
      <input
        type="text"
        inputMode="numeric"
        // Sized to its content so the counter keeps reading as "1 / 12"; `ch`
        // is exact here because the font is tabular.
        style={{ width: `${Math.max(shown.length, 1)}ch` }}
        value={shown}
        readOnly={pendingJump !== null}
        placeholder={pendingJump !== null ? "#" : undefined}
        aria-label="Current page"
        title="Jump to page"
        className={cn(
          // box-content + matching negative margin keeps the padded hit area
          // from widening the counter, so spacing is identical to plain text.
          "bg-transparent text-center tabular-nums rounded-sm outline-none cursor-pointer transition-colors",
          "box-content px-1 -mx-1 hover:bg-muted focus:bg-muted focus:ring-1 focus:ring-ring focus:cursor-text",
          pendingJump !== null && "bg-primary/10 text-primary placeholder:text-primary/50"
        )}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, maxLen))}
        onFocus={(e) => { setDraft(String(currentSlide)); e.currentTarget.select(); }}
        onBlur={() => {
          if (!cancelled.current) commit(draft);
          cancelled.current = false;
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      {" / "}
      {totalSlides}
    </span>
  );
}

// Previous / [count] / Next cluster, shared by both controller footers. Desktop
// uses the inline default size with the slide count between the buttons; mobile
// uses the large, full-width variant and renders the count separately above.
export function ControllerNav({
  currentSlide,
  totalSlides,
  onGoTo,
  pendingJump = null,
  size = "default",
  showCount = true,
  className,
}: {
  currentSlide: number;
  totalSlides: number;
  onGoTo: (slide: number) => void;
  pendingJump?: string | null;
  size?: "default" | "lg";
  showCount?: boolean;
  className?: string;
}) {
  const big = size === "lg";
  const buttonClass = big ? "flex-1 h-12 text-base" : undefined;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        variant="outline"
        className={buttonClass}
        onClick={() => onGoTo(currentSlide - 1)}
        disabled={currentSlide <= 1}
      >
        Previous
      </Button>
      {showCount && (
        <SlideCounter
          currentSlide={currentSlide}
          totalSlides={totalSlides}
          onGoTo={onGoTo}
          pendingJump={pendingJump}
        />
      )}
      <Button
        variant="outline"
        className={buttonClass}
        onClick={() => onGoTo(currentSlide + 1)}
        disabled={currentSlide >= totalSlides}
      >
        Next
      </Button>
    </div>
  );
}
