import { Card, CardContent } from "@/components/ui/card";
import { createPortal } from "react-dom";

export function DialogOverlay({
  children,
  onClose,
  maxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  // Portal to <body> so the overlay always covers the viewport: an ancestor
  // with backdrop-filter (e.g. the home page's blurred nav) would otherwise
  // become the containing block for this fixed element and collapse it to
  // that ancestor's box.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className={`w-full ${maxWidth} max-h-[90dvh] overflow-y-auto`}>
        <CardContent className="pt-6 space-y-4">{children}</CardContent>
      </Card>
    </div>,
    document.body
  );
}
