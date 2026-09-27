import { Suspense } from "react";
import Builder from "@/components/builder/Builder";

export const metadata = {
  title: "Resume Builder",
  description: "Edit your resume with a live PDF preview and download it in one click.",
};

export default function BuilderPage() {
  return (
    <Suspense>
      <Builder />
    </Suspense>
  );
}
