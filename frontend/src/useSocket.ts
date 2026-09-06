import { useEffect, useRef } from "react";

export function useSocket(onEvent: (event: string, payload: unknown) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);

    socket.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        callbackRef.current(parsed.event, parsed.payload);
      } catch {
        // ignore malformed frames
      }
    };

    return () => socket.close();
  }, []);
}
