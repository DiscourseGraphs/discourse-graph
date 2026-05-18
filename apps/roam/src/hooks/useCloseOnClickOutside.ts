import { useEffect, type RefObject } from "react";

export const useCloseOnClickOutside = ({
  isOpen,
  onClose,
  popoverRef,
  targetRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  popoverRef: RefObject<HTMLElement | null>;
  targetRef: RefObject<HTMLElement>;
}): void => {
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent): void => {
      const clickTarget = event.target;
      if (!(clickTarget instanceof Element)) return;
      if (popoverRef.current?.contains(clickTarget)) return;
      if (targetRef.current?.contains(clickTarget)) return;
      onClose();
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    return () =>
      document.removeEventListener("mousedown", handleMouseDown, true);
  }, [isOpen, onClose, popoverRef, targetRef]);
};
