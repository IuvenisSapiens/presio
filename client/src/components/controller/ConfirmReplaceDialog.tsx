import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";

// "Replace PDF?" confirmation shared by the controller and the home screen's
// recents list. Replacing swaps the deck's bytes under the same code, so the
// user should know what doesn't survive: drawings (keyed by slide number) and
// speaker notes edited inside Presio but not baked into the new file.
export function ConfirmReplaceDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <DialogOverlay onClose={onClose}>
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-semibold">Replace PDF?</h2>
        <p className="text-sm text-muted-foreground">
          The presentation keeps its code, link and passphrase, but existing
          drawings are cleared and speaker notes edited in Presio are lost — the
          new file's own notes are used instead.
        </p>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={onConfirm}>
          Replace
        </Button>
      </div>
    </DialogOverlay>
  );
}
