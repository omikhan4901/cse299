"use client";

import { Button, Tooltip } from "antd";
import { Lock, Sparkles } from "lucide-react";
import { AI_ENABLED } from "@/lib/config";
import { CreditTooltip } from "../Credits";
import PlanTag from "../billing/PlanTag";

export const AI_LOCKED_MESSAGE = "AI features are paused while we upgrade our AI provider. Everything else works as usual.";

/** A button for a Gemini-powered action. Shows a lock while AI is switched off. */
export function AiButton({ children, onClick, loading, size = "small", block, type = "default", feature = "refine" }) {
  if (!AI_ENABLED) {
    return (
      <Tooltip title={AI_LOCKED_MESSAGE}>
        <Button size={size} block={block} disabled icon={<Lock size={13} />}>
          {children}
        </Button>
      </Tooltip>
    );
  }
  return (
    <CreditTooltip feature={feature}>
      <Button size={size} block={block} type={type} onClick={onClick} loading={loading} icon={<Sparkles size={13} />} className="!border-brand-200 !text-brand">
        {children}
        <PlanTag feature={feature} />
      </Button>
    </CreditTooltip>
  );
}
