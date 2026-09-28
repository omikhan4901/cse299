"use client";

import { useCallback, useState } from "react";
import { App } from "antd";
import { ArrowDownToLine, ArrowUpFromLine, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { applyOperations } from "@/lib/ingest/ops";
import { pullUpdates, resumeFromProfile, saveToProfile } from "@/lib/profile";
import { withContentOf, normalizeResume } from "@/lib/resume";
import ReviewChanges from "../review/ReviewChanges";

/**
 * The builder's link to the Career Profile (V2): fill a resume from it, pull what changed
 * in it since, and save good rewrites back to it. Every change is reviewed first.
 * Returns menu items for the builder and the review dialog to render.
 */
export function useProfileSync({ token, resume, setResume, enabled }) {
  const { message, modal } = App.useApp();
  const [review, setReview] = useState(null); // { kind, operations, target, profile }

  const getProfile = useCallback(async () => {
    const { data } = await api("/profile", { token });
    if (!data) {
      modal.info({ title: "No Career Profile yet", content: "Set up your Career Profile first: it holds everything about you, and every resume can start from it.", okText: "OK" });
      return null;
    }
    return data;
  }, [token, modal]);

  const run = (fn) => async () => {
    try {
      await fn();
    } catch (err) {
      message.error(err.message);
    }
  };

  const fill = run(async () => {
    const profile = await getProfile();
    if (!profile) return;
    modal.confirm({
      title: "Fill from your Career Profile?",
      content: "This replaces the content of this resume with everything in your profile. Your template and colours stay the same.",
      okText: "Replace content",
      onOk: () => {
        setResume((r) => withContentOf(r, normalizeResume({ ...r, ...resumeFromProfile(profile) })));
        message.success("Filled from your profile");
      },
    });
  });

  const pull = run(async () => {
    const profile = await getProfile();
    if (profile) setReview({ kind: "pull", operations: pullUpdates(resume, profile), target: resume, profile });
  });

  const push = run(async () => {
    const profile = await getProfile();
    if (profile) setReview({ kind: "push", operations: saveToProfile(resume, profile), target: normalizeResume(profile), profile });
  });

  const apply = async (ops) => {
    if (review.kind === "pull") {
      setResume((r) => applyOperations(r, ops));
      message.success(`${ops.length} update${ops.length === 1 ? "" : "s"} added`);
      setReview(null);
      return;
    }
    const next = applyOperations(review.profile, ops);
    try {
      await api("/profile", { token, method: "PUT", body: { ...next, summaries: review.profile.summaries || [], baseRev: review.profile.rev } });
      message.success("Saved to your profile");
      setReview(null);
    } catch (err) {
      if (err.code === "conflict") {
        // Changed in another tab meanwhile: show the changes again against the newer copy.
        const latest = err.data;
        message.info("Your profile just changed somewhere else. Here are the changes against the newest version.");
        setReview({ kind: "push", operations: saveToProfile(resume, latest), target: normalizeResume(latest), profile: latest });
      } else message.error(err.message);
    }
  };

  const items = enabled
    ? [
        { key: "profile-fill", icon: <UserRound size={15} />, label: "Fill from profile", onClick: fill },
        { key: "profile-pull", icon: <ArrowDownToLine size={15} />, label: "Pull updates from profile", onClick: pull },
        { key: "profile-push", icon: <ArrowUpFromLine size={15} />, label: "Save to profile", onClick: push },
      ]
    : [];

  const dialog = (
    <ReviewChanges
      open={!!review}
      title={review?.kind === "push" ? "Save to your profile" : "Updates from your profile"}
      subtitle={
        review?.kind === "push"
          ? "What this resume has that your profile doesn't. Pick what to keep."
          : "What changed in your profile for the items on this resume."
      }
      operations={review?.operations}
      target={review?.target}
      applyLabel={review?.kind === "push" ? "Save" : "Add"}
      onApply={apply}
      onClose={() => setReview(null)}
    />
  );

  return { items, dialog };
}
