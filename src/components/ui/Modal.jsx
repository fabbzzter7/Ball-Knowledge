import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import Button from "./Button";
import SurfaceCard from "./SurfaceCard";

export default function Modal({
  children,
  title,
  onClose,
  closeLabel = "Close",
  className = "",
  cardClassName = "",
  variant = "default",
  showClose = true,
  closeOnBackdrop = false,
}) {
  const titleId = useId();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus?.();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const modal = (
    <motion.div
      className={["bk-modal-overlay", className].filter(Boolean).join(" ")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <SurfaceCard
        as={motion.div}
        className={[
          "bk-modal-card",
          `bk-modal-card--${variant}`,
          cardClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        initial={{ opacity: 0, scale: 0.94, y: 22 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || showClose) && (
          <div className="bk-modal-top">
            {title && <h2 id={titleId}>{title}</h2>}
            {showClose && (
              <Button
                ref={closeButtonRef}
                className="bk-modal-close"
                variant="secondary"
                onClick={onClose}
                aria-label={closeLabel}
              >
                <X size={18} />
              </Button>
            )}
          </div>
        )}
        {children}
      </SurfaceCard>
    </motion.div>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
}
