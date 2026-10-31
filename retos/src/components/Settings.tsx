"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setSoundEnabled, sfx } from "@/lib/sfx";

interface Ctx { sound: boolean; reduced: boolean; toggleSound(): void; toggleMotion(): void }
const SettingsCtx = createContext<Ctx>({ sound: true, reduced: false, toggleSound() {}, toggleMotion() {} });
export const useSettings = () => useContext(SettingsCtx);

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } };

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [sound, setSound] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const s = read("retos:sound");
    const m = read("retos:reduced");
    const sys = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSound(s === null ? true : s === "1");
    setReduced(m === null ? sys : m === "1");
  }, []);
  useEffect(() => { setSoundEnabled(sound); }, [sound]);
  useEffect(() => { document.documentElement.dataset.motion = reduced ? "reduced" : "full"; }, [reduced]);

  const toggleSound = useCallback(() => setSound((v) => { write("retos:sound", v ? "0" : "1"); if (!v) setTimeout(() => { setSoundEnabled(true); sfx.ok(); }, 0); return !v; }), []);
  const toggleMotion = useCallback(() => setReduced((v) => { write("retos:reduced", v ? "0" : "1"); return !v; }), []);
  const value = useMemo(() => ({ sound, reduced, toggleSound, toggleMotion }), [sound, reduced, toggleSound, toggleMotion]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}
