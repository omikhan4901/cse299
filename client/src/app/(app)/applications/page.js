import { Suspense } from "react";
import ApplicationsPage from "@/components/applications/ApplicationsPage";

export const metadata = { title: "Applications" };

export default function Page() {
  return (
    <Suspense>
      <ApplicationsPage />
    </Suspense>
  );
}
