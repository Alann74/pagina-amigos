"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, clearCreds, loadCreds, saveCreds } from "./client";
import type { Creds } from "./client";
import type { Action, RoomView } from "./types";

export interface RoomError { code: string; message: string }

export function useRoom(code: string) {
  const [creds, setCredsState] = useState<Creds | null | undefined>(undefined);
  const [view, setView] = useState<RoomView | null>(null);
  const [fatal, setFatal] = useState<RoomError | null>(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const version = useRef(-1);
  const wake = useRef<() => void>(() => {});
  const busyRef = useRef(false);

  useEffect(() => { setCredsState(loadCreds(code)); }, [code]);

  const setCreds = useCallback((c: Creds | null) => {
    if (c) saveCreds(code, c); else clearCreds(code);
    version.current = -1;
    setView(null);
    setCredsState(c);
  }, [code]);

  useEffect(() => {
    if (!creds) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const tick = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const r = await api.poll(code, creds, version.current);
        if (stopped) return;
        setOnline(true);
        if (r.view) {
          if (r.version >= version.current) { version.current = r.version; setView(r.view); }
        } else {
          setView((v) => {
            if (!v) return v;
            if (v.players.every((p) => (r.connected[p.id] ?? p.connected) === p.connected)) return v;
            return { ...v, players: v.players.map((p) => ({ ...p, connected: r.connected[p.id] ?? p.connected })) };
          });
        }
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && e.status === 401) { clearCreds(code); setCredsState(null); setView(null); return; }
        if (e instanceof ApiError && e.status === 404) { setFatal({ code: e.code, message: e.message }); return; }
        setOnline(false);
      } finally { running = false; }
      if (!stopped) timer = setTimeout(tick, document.hidden ? 4000 : 1000);
    };
    wake.current = () => { if (timer) clearTimeout(timer); void tick(); };
    void tick();
    const onVis = () => wake.current();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      stopped = true; if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [code, creds]);

  /** Envía una acción. Devuelve null si salió bien o el mensaje de error. */
  const send = useCallback(async (action: Action): Promise<string | null> => {
    if (!creds || busyRef.current) return null; // evita doble toque
    busyRef.current = true; setBusy(true);
    try {
      const r = await api.act(code, creds, action);
      if (r.view && r.view.version >= version.current) { version.current = r.view.version; setView(r.view); }
      return null;
    } catch (e) {
      wake.current();
      return e instanceof ApiError ? e.message : "No se pudo enviar. Probá de nuevo.";
    } finally { busyRef.current = false; setBusy(false); }
  }, [code, creds]);

  return { creds, setCreds, view, fatal, online, busy, send };
}
