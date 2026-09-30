"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

/** Reports uncaught errors and rejected promises in the browser (lib/reportError.js). */
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e) => reportError(e.error || e.message);
    const onRejection = (e) => reportError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
