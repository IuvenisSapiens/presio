import { useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { useIsTouchDevice } from "@/hooks/useIsMobile";
import { lsGetString, lsSetString, STORAGE_KEYS } from "@/lib/storage";

// First-run notice for touch devices (phones/tablets, any orientation): Presio's
// authoring surface is built for desktop, so we set expectations up front and
// point out the useful mobile role (joining as a viewer, or acting as a remote
// for a presentation on another screen). Shown once, then remembered.
export function MobileNotice() {
  // Touch-first screen, not width — an iPad in landscape exceeds the mobile
  // width breakpoint but is every bit a touchscreen.
  const isMobile = useIsTouchDevice();
  const [open, setOpen] = useState(
    () => lsGetString(STORAGE_KEYS.mobileNoticeSeen) !== "true"
  );

  if (!isMobile || !open) return null;

  const dismiss = () => {
    lsSetString(STORAGE_KEYS.mobileNoticeSeen, "true");
    setOpen(false);
  };

  return (
    <DialogOverlay onClose={dismiss} maxWidth="max-w-xs">
      <div className="flex flex-col items-center gap-3 text-center">
        <Smartphone className="text-muted-foreground" size={28} />
        <h2 className="text-lg font-semibold">Best on desktop</h2>
        <p className="text-sm text-muted-foreground">
          Presio is mainly designed for desktop. On your phone you can still join
          a presentation as a viewer, or use it as a remote to control a
          presentation running on another screen.
        </p>
        <Button className="w-full" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </DialogOverlay>
  );
}
