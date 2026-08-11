import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getDocument } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountControl } from "@/components/AccountControl";
import { PresioLogo } from "@/components/PresioLogo";
import { MobileNotice } from "@/components/MobileNotice";
import { idbPut } from "@/lib/localStore";
import { setSessionAuth } from "@/lib/utils";
import { loadExternalPdfMeta, createExternalSession } from "@/lib/externalSession";
import { supabase } from "@/lib/supabaseClient";
import "@/lib/pdf"; // ensure pdf.js worker is configured

// -----------------------------------------------------------------------------
// Home2 — redesign mockup, ported from a standalone HTML prototype into real
// components/tokens so it can be iterated on in place. Upload/join logic is
// copied from Home.tsx; only "recent presentations" was left out for now.
// The dashed play-button frames are gif/mp4 slots — swap the placeholder for
// a <video>/<img> once a capture exists, the layout doesn't need to change.
// -----------------------------------------------------------------------------

const CUES = [
  {
    label: "Local by default",
    title: "Nothing leaves your browser.",
    body: "Your deck is decoded locally and stored in this browser only. It works offline, opens instantly, and there's nothing to upload unless you choose to share it.",
    gif: "cue-01-local.mp4",
  },
  {
    label: "One code, any screen",
    title: "Share a code, present everywhere.",
    body: "Log in to sync a deck online and hand out a 6-character code. Anyone who enters it watches your slides change live — no app, no sign-up.",
    gif: "cue-02-sync.mp4",
  },
  {
    label: "Notes & media, built in",
    title: "Speaker notes and video that just play.",
    body: "Write in Typst or LaTeX, attach notes and media with one line, and Presio reads them automatically. Embedded video and GIFs stay in sync across every viewer.",
    gif: "cue-03-notes.mp4",
  },
  {
    label: "Built for the podium",
    title: "A controller that stays out of the way.",
    body: "A presentation timer, remappable keyboard shortcuts, and a layout you can rearrange — so driving the deck never competes with presenting it.",
    gif: "cue-04-controller.mp4",
  },
];

const STRIP_ITEMS = [
  "Typst & LaTeX notes",
  "Offline-first",
  "6-character join codes",
  "Embedded video, synced",
  "Remappable shortcuts",
  "Presentation timer",
];

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-[1px]">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function CueMedia({ gif }: { gif: string }) {
  return (
    <div
      className="group relative aspect-video overflow-hidden rounded-2xl border shadow-sm"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, var(--home2-grid) 0 1px, transparent 1px 14px)",
        backgroundColor: "var(--card)",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors group-hover:text-[var(--home2-accent)] group-hover:border-[var(--home2-accent)]">
          <PlayGlyph />
        </div>
      </div>
      <span className="absolute bottom-3 left-3 rounded-md border bg-background px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
        {gif}
      </span>
    </div>
  );
}

function Cue({ cue, index, flip }: { cue: (typeof CUES)[number]; index: number; flip: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 items-center gap-7 transition-all duration-700 ease-out md:grid-cols-2 md:gap-16 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
    >
      <div className={flip ? "md:order-2" : "md:order-1"}>
        <div className="mb-3.5 flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-[var(--home2-accent)]">
          <span className="text-muted-foreground">CUE {String(index + 1).padStart(2, "0")}</span>
          {cue.label}
        </div>
        <h3 className="mb-3 text-xl font-semibold leading-tight tracking-tight md:text-2xl">
          {cue.title}
        </h3>
        <p className="max-w-[42ch] text-[15px] text-muted-foreground">{cue.body}</p>
      </div>
      <div className={flip ? "md:order-1" : "md:order-2"}>
        <CueMedia gif={cue.gif} />
      </div>
    </div>
  );
}

export default function Home2() {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const CODE_LENGTH = 6;
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const charRefs = useRef<(HTMLInputElement | null)[]>([]);
  const code = chars.join("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setError("");
      setUploading(true);
      setProgress(0);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        setProgress(100);
        const doc = await getDocument({ data: bytes }).promise;
        const totalSlides = doc.numPages;
        doc.destroy();
        const filename = file.name.replace(/\.pdf$/i, "");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) headers.Authorization = `Bearer ${sessionData.session.access_token}`;
        const res = await fetch("/api/sessions/local", {
          method: "POST",
          headers,
          body: JSON.stringify({ filename, total_slides: totalSlides }),
        });
        if (!res.ok) throw new Error("Failed to create session");
        const { id, controllerToken, passphrase } = await res.json();
        if (controllerToken) setSessionAuth(id, { controllerToken, passphrase });
        try {
          await idbPut({ id, filename, totalSlides, blob: file, createdAt: Date.now() });
        } catch {
          throw new Error(
            "Couldn't store the presentation in this browser. Private/incognito mode isn't supported — please use a normal window."
          );
        }
        navigate(`/s/${id}/share`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [navigate]
  );

  const submitUrl = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!pdfUrl.trim() || urlBusy) return;
      setError("");
      setUrlBusy(true);
      try {
        const meta = await loadExternalPdfMeta(pdfUrl);
        const { data: sessionData } = await supabase.auth.getSession();
        const id = await createExternalSession(meta, sessionData.session?.access_token);
        navigate(`/s/${id}/share`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to create session");
      } finally {
        setUrlBusy(false);
      }
    },
    [pdfUrl, urlBusy, navigate]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf") upload(file);
      else setError("Please drop a PDF file");
    },
    [upload]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragging(false);
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) upload(file);
    },
    [upload]
  );

  useEffect(() => {
    if (code.length === CODE_LENGTH) navigate(`/s/${code}?role=viewer`);
  }, [code, navigate]);

  return (
    <div
      className="home2 min-h-screen bg-background text-foreground"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Scoped accent tokens — the rest of the app stays pure grayscale;
          this page borrows one warm accent to try out on the redesign. */}
      <style>{`
        .home2 { --home2-accent: #C97A1F; --home2-accent-soft: rgba(201,122,31,0.12); --home2-grid: rgba(21,23,26,0.06); }
        .dark .home2 { --home2-accent: #F2A93C; --home2-accent-soft: rgba(242,169,60,0.14); --home2-grid: rgba(242,241,237,0.06); }
      `}</style>

      <div className="border-b bg-[var(--home2-accent-soft)] px-4 py-2 text-center font-mono text-xs text-muted-foreground">
        <strong className="font-semibold text-foreground">/home2</strong> — redesign in progress, copy is a first draft
      </div>

      <nav
        className={`sticky top-0 z-40 flex items-center justify-between px-6 py-4 backdrop-blur transition-colors ${
          scrolled ? "border-b bg-background/90" : "border-b border-transparent bg-background/70"
        }`}
      >
        <div className="flex items-center gap-2">
          <PresioLogo className="h-5 w-auto text-foreground" />
          <span className="font-mono text-base font-semibold tracking-tight">Presio</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#cues" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            How it works
          </a>
          <Link
            to="/about"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            About
          </Link>
          <AccountControl />
          <ThemeToggle />
        </div>
      </nav>

      {/* ---------------------------------------------------------------- hero */}
      <section
        className="relative px-6 pb-24 pt-16"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, var(--home2-accent-soft), transparent 70%)",
        }}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-[0.92fr_1.08fr] md:gap-14">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-[var(--home2-accent)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--home2-accent)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--home2-accent)]" />
              </span>
              No account, no install
            </div>
            <h1 className="mb-5 font-mono text-4xl font-semibold leading-[1.06] tracking-tight text-balance md:text-5xl">
              Turn a PDF into a{" "}
              <span className="text-[var(--home2-accent)]">live</span> presentation.
            </h1>
            <p className="mb-8 max-w-[46ch] text-base text-muted-foreground md:text-[17px]">
              Drop a deck and get a controller with notes and a viewer that mirrors it in real
              time — on this laptop, or on every screen in the room.
            </p>

            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div
                className={`cursor-pointer rounded-xl border-2 border-dashed p-9 text-center transition-colors ${
                  dragging
                    ? "border-[var(--home2-accent)] bg-[var(--home2-accent-soft)]"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onClick={() => document.getElementById("home2-file-input")?.click()}
              >
                {uploading ? (
                  <div className="mx-auto w-full max-w-xs space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {progress < 100 ? `Uploading… ${progress}%` : "Processing…"}
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--home2-accent)] transition-[width] duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mx-auto mb-3 h-8 w-8 text-muted-foreground/70"
                    >
                      <path d="M12 15V4M12 4l-4 4M12 4l4 4" />
                      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                    </svg>
                    <p className="text-sm text-muted-foreground">Drop a PDF here or click to browse</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">stays in this browser by default</p>
                  </>
                )}
                <input
                  id="home2-file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={onFileSelect}
                />
              </div>

              <form onSubmit={submitUrl} className="mt-3.5 flex gap-2">
                <input
                  type="url"
                  inputMode="url"
                  placeholder="…or paste a URL to a PDF"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {pdfUrl.trim() && (
                  <Button type="submit" variant="outline" disabled={urlBusy}>
                    {urlBusy ? "Loading…" : "Go"}
                  </Button>
                )}
              </form>

              {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or join existing</span>
                </div>
              </div>

              <div className="flex justify-center gap-2">
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      charRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    value={chars[i]}
                    className="h-12 w-10 rounded-md border border-input bg-background text-center font-mono text-lg font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      if (!val) return;
                      const next = [...chars];
                      next[i] = val[val.length - 1];
                      setChars(next);
                      if (i < CODE_LENGTH - 1) charRefs.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        e.preventDefault();
                        const next = [...chars];
                        if (chars[i]) {
                          next[i] = "";
                          setChars(next);
                        } else if (i > 0) {
                          next[i - 1] = "";
                          setChars(next);
                          charRefs.current[i - 1]?.focus();
                        }
                      } else if (e.key === "ArrowLeft" && i > 0) {
                        charRefs.current[i - 1]?.focus();
                      } else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
                        charRefs.current[i + 1]?.focus();
                      } else if (e.key === "Enter" && code.length === CODE_LENGTH) {
                        navigate(`/s/${code}?role=viewer`);
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "");
                      const next = [...chars];
                      for (let j = 0; j < CODE_LENGTH - i && j < pasted.length; j++) {
                        next[i + j] = pasted[j];
                      }
                      setChars(next);
                      const focusIdx = Math.min(i + pasted.length, CODE_LENGTH - 1);
                      charRefs.current[focusIdx]?.focus();
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* mock browser + phone visual, purely illustrative */}
          <div className="relative mx-auto aspect-[4/3.1] w-full max-w-[460px] md:mx-0 md:max-w-none" aria-hidden="true">
            <div className="absolute inset-0 mr-[8%] mb-[10%] flex flex-col overflow-hidden rounded-xl border bg-card shadow-lg">
              <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span className="h-2 w-2 rounded-full bg-border" />
                </div>
                <div className="flex-1 rounded bg-background px-2 py-0.5 text-center font-mono text-[10.5px] text-muted-foreground">
                  presio.xyz/s/A3F9K2
                </div>
              </div>
              <div className="grid flex-1 grid-cols-[64px_1fr_1fr] gap-px bg-border">
                <div className="flex flex-col gap-1.5 bg-card p-1.5">
                  <div className="aspect-[4/3] rounded border bg-[var(--home2-accent-soft)] ring-1 ring-[var(--home2-accent)]" />
                  <div className="aspect-[4/3] rounded border bg-muted" />
                  <div className="aspect-[4/3] rounded border bg-muted" />
                  <div className="aspect-[4/3] rounded border bg-muted" />
                </div>
                <div className="flex items-center justify-center bg-card p-3.5">
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border bg-gradient-to-br from-muted to-background">
                    <div className="absolute left-[14%] right-[30%] top-[22%] h-1.5 rounded bg-border" />
                    <div className="absolute right-[45%] left-[14%] top-[34%] h-1.5 rounded bg-border" />
                  </div>
                </div>
                <div className="bg-card p-3">
                  <div className="mb-2 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground/70">
                    Speaker notes
                  </div>
                  <div className="mb-1.5 h-1.5 rounded bg-muted" />
                  <div className="mb-1.5 h-1.5 w-[90%] rounded bg-muted" />
                  <div className="mb-1.5 h-1.5 w-[70%] rounded bg-muted" />
                  <div className="h-1.5 w-[80%] rounded bg-muted" />
                </div>
              </div>
            </div>
            <div className="absolute -right-[2%] -bottom-[6%] hidden w-[34%] rounded-[22px] bg-foreground p-2 shadow-lg sm:block">
              <div className="flex h-full flex-col overflow-hidden rounded-[15px] bg-card">
                <div className="flex items-center justify-between px-2 pt-2 pb-1">
                  <span className="flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-wide text-[var(--home2-accent)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--home2-accent)] opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--home2-accent)]" />
                    </span>
                    Live
                  </span>
                </div>
                <div className="relative m-2 flex-1 rounded border bg-gradient-to-br from-muted to-background">
                  <div className="absolute left-[14%] right-[30%] top-[22%] h-1 rounded bg-border" />
                  <div className="absolute right-[45%] left-[14%] top-[32%] h-1 rounded bg-border" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- marquee */}
      <div className="overflow-hidden border-y bg-card py-3.5">
        <div className="flex w-max animate-[home2-scroll_32s_linear_infinite] gap-12 whitespace-nowrap font-mono text-[12.5px] text-muted-foreground/80 motion-reduce:animate-none">
          {[...STRIP_ITEMS, ...STRIP_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2.5">
              <span className="text-muted-foreground/40">—</span>
              {item}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes home2-scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>

      {/* ---------------------------------------------------------------- cues */}
      <section id="cues" className="px-6 py-24 md:py-28">
        <div className="mx-auto flex max-w-6xl flex-col gap-28 md:gap-32">
          {CUES.map((cue, i) => (
            <Cue key={cue.label} cue={cue} index={i} flip={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ final cta */}
      <section className="border-t bg-card px-6 py-24 text-center">
        <h2 className="mb-3.5 text-2xl font-semibold tracking-tight md:text-3xl">
          Your next talk starts with a PDF.
        </h2>
        <p className="mx-auto mb-7 max-w-[44ch] text-[15px] text-muted-foreground">
          No sign-up to try it. Drop a deck and you're presenting in under a minute.
        </p>
        <Button
          size="lg"
          className="bg-[var(--home2-accent)] font-mono text-primary-foreground hover:bg-[var(--home2-accent)]/90"
          onClick={() => document.getElementById("home2-file-input")?.click()}
        >
          Drop a PDF to start →
        </Button>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
        <span>© Presio — built for presenting PDFs</span>
        <div className="flex gap-4">
          <Link to="/about" className="hover:text-foreground">
            About
          </Link>
          <Link to="/check" className="hover:text-foreground">
            presio.xyz/check
          </Link>
        </div>
      </footer>

      <MobileNotice />
    </div>
  );
}
