"use client";

import { useEffect } from "react";
import type { Serwist } from "@serwist/window";

declare global {
  interface Window {
    serwist?: Serwist;
  }
}

export function RegisterServiceWorker(): null {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.serwist !== undefined) {
      window.serwist.register().catch(() => {});
    }
  }, []);
  return null;
}
