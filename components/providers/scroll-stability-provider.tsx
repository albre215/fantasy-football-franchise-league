"use client";

import { useEffect } from "react";

interface ScrollSnapshot {
  left: number;
  top: number;
}

const USER_SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " "
]);

function isButtonLikeElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'
    )
  );
}

export function ScrollStabilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let pendingSnapshot: ScrollSnapshot | null = null;
    let lastKnownScrollTop = 0;
    let stopPreserving = false;
    let frameCount = 0;
    let animationFrameId = 0;

    function clearPreservation() {
      pendingSnapshot = null;
      stopPreserving = false;
      frameCount = 0;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    }

    function markUserScrollIntent() {
      if (!pendingSnapshot) {
        return;
      }

      stopPreserving = true;
      clearPreservation();
    }

    function restoreScrollPosition() {
      if (!pendingSnapshot || stopPreserving) {
        clearPreservation();
        return;
      }

      const currentTop = window.scrollY;

      if (currentTop !== pendingSnapshot.top) {
        window.scrollTo({
          left: pendingSnapshot.left,
          top: pendingSnapshot.top,
          behavior: "auto"
        });
      }

      frameCount += 1;

      if (frameCount >= 24) {
        clearPreservation();
        return;
      }

      animationFrameId = requestAnimationFrame(restoreScrollPosition);
    }

    function beginPreservingScroll(target: EventTarget | null) {
      if (!isButtonLikeElement(target)) {
        return;
      }

      pendingSnapshot = {
        left: window.scrollX,
        top: window.scrollY
      };
      lastKnownScrollTop = window.scrollY;
      stopPreserving = false;
      frameCount = 0;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(restoreScrollPosition);
    }

    function handleScroll() {
      if (!pendingSnapshot) {
        return;
      }

      const currentTop = window.scrollY;

      if (currentTop !== pendingSnapshot.top && currentTop !== lastKnownScrollTop) {
        markUserScrollIntent();
        return;
      }

      lastKnownScrollTop = currentTop;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!pendingSnapshot) {
        return;
      }

      if (USER_SCROLL_KEYS.has(event.key)) {
        markUserScrollIntent();
      }
    }

    function handleClick(event: MouseEvent) {
      beginPreservingScroll(event.target);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("wheel", markUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", markUserScrollIntent, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearPreservation();
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("wheel", markUserScrollIntent);
      window.removeEventListener("touchmove", markUserScrollIntent);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return children;
}
