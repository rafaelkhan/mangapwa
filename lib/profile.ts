"use client";

import { useSyncExternalStore } from "react";

const KEY = "mangapwa.profileName";
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getProfileName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) ?? "";
}

export function setProfileName(name: string): void {
  if (typeof window === "undefined") return;
  const v = name.trim();
  if (v) window.localStorage.setItem(KEY, v);
  else window.localStorage.removeItem(KEY);
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive local "tracker profile" name. Empty string means not set yet. */
export function useProfileName(): string {
  return useSyncExternalStore(subscribe, getProfileName, () => "");
}
