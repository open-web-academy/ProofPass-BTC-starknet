"use client";

import { useEffect, useState } from "react";
import type { GeneratedProof } from "../lib/types";

const STORAGE_KEY = "proofpass:lastProof";

export function useStoredProof() {
  const [proof, setProof] = useState<GeneratedProof | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as GeneratedProof;
      setProof(parsed);
    } catch {
      // ignore
    }
  }, []);

  const save = (p: GeneratedProof) => {
    setProof(p);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    }
  };

  const clear = () => {
    setProof(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return { proof, save, clear };
}

