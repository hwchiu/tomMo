"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { IssueList } from "@/components/issue-views";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <IssueQuery />
    </Suspense>
  );
}

function IssueQuery() {
  const query = useSearchParams();
  return (
    <IssueList
      factoryId={query.get("factory") ?? ""}
      severity={query.get("severity") ?? ""}
      status={query.get("status") ?? ""}
      overdue={query.get("overdue") === "1"}
    />
  );
}
