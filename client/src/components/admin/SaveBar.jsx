"use client";

import { Button } from "antd";
import { AnimatePresence, motion } from "motion/react";

/** Sticky "unsaved changes" bar for the settings tabs. */
export default function SaveBar({ dirty, saving, onSave, onDiscard }) {
  return (
    <AnimatePresence>
      {dirty ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-fit items-center gap-4 rounded-2xl bg-ink px-5 py-3 text-sm text-white shadow-2xl"
        >
          <span>You have unsaved changes</span>
          <Button size="small" onClick={onDiscard}>Discard</Button>
          <Button size="small" type="primary" loading={saving} onClick={onSave}>Save & publish</Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
