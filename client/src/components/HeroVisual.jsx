"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Eye, Download, Sparkles } from "lucide-react";

const CARDS = [
  { id: "Modern", x: "-34%", rotate: -7, scale: 0.9, z: 1, float: "0s" },
  { id: "CoolBlue", x: "34%", rotate: 7, scale: 0.9, z: 1, float: "-2s" },
  { id: "Classic", x: "0%", rotate: 0, scale: 1, z: 3, float: "-4s" },
];

/** Fanned-out template previews that fly in, then gently float. */
export default function HeroVisual() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[520px] sm:h-[520px]">
      {CARDS.map((c, i) => (
        <motion.div
          key={c.id}
          className="absolute top-1/2 left-1/2 w-[58%]"
          style={{ zIndex: c.z }}
          initial={{ opacity: 0, x: "-50%", y: "-30%", rotate: 0, scale: 0.8 }}
          animate={{ opacity: 1, x: `calc(-50% + ${c.x})`, y: "-50%", rotate: c.rotate, scale: c.scale }}
          transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.25 + i * 0.12 }}
          whileHover={{ scale: c.scale + 0.04, rotate: c.rotate * 0.6, zIndex: 4, transition: { type: "spring", stiffness: 300 } }}
        >
          <div className="animate-float overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/10" style={{ animationDelay: c.float }}>
            <Image src={`/templates/${c.id}.jpg`} alt={`${c.id} resume template`} width={827} height={1170} priority className="h-auto w-full" />
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.6, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.9 }}
        className="absolute top-10 -left-2 z-10 hidden sm:block"
      >
        <div className="animate-float flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-ink shadow-lg ring-1 ring-slate-900/5" style={{ animationDelay: "-1s" }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Eye size={16} className="text-brand" /> Live preview
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.6, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 1.1 }}
        className="absolute right-0 bottom-12 z-10 hidden sm:block"
      >
        <div className="animate-float flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white shadow-lg" style={{ animationDelay: "-3s" }}>
          <Download size={16} className="text-teal-300" /> Resume.pdf ready
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 1.3 }}
        className="absolute top-2 right-6 z-10 hidden sm:block"
      >
        <div className="animate-float flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-400 text-white shadow-lg" style={{ animationDelay: "-5s" }}>
          <Sparkles size={20} />
        </div>
      </motion.div>
    </div>
  );
}
