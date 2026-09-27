"use client";

import { motion } from "motion/react";

const ease = [0.22, 1, 0.36, 1];

/** Fades and slides its children up the first time they scroll into view. */
export function Reveal({ children, delay = 0, y = 24, className, as = "div" }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease, delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * A container whose <StaggerItem> children reveal one after another, when
 * scrolled into view (or straight away with `immediate`, e.g. in a hero).
 */
export function Stagger({ children, className, gap = 0.08, as = "div", immediate = false, delay = 0 }) {
  const Tag = motion[as];
  const trigger = immediate ? { animate: "show" } : { whileInView: "show", viewport: { once: true, margin: "-60px" } };
  return (
    <Tag
      className={className}
      initial="hidden"
      {...trigger}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = "div" }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      variants={{ hidden: { opacity: 0, y: 26, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease } } }}
    >
      {children}
    </Tag>
  );
}
