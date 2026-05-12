import { useEffect, useState } from "react";

const KEY = "swiftly:hideBalance";
const EVT = "swiftly:hideBalance:changed";

export function useHideBalance() {
  const [hide, setHide] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "1";
  });

  useEffect(() => {
    const onChange = () => setHide(localStorage.getItem(KEY) === "1");
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (v: boolean) => {
    localStorage.setItem(KEY, v ? "1" : "0");
    setHide(v);
    window.dispatchEvent(new Event(EVT));
  };

  return { hide, setHide: update, toggle: () => update(!hide) };
}