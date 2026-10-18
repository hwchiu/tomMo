"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { IssueCreate } from "@/components/issue-views";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewIssue />
    </Suspense>
  );
}

function NewIssue() {
  const query = useSearchParams();
  return <IssueCreate factoryId={query.get("factory") ?? ""} />;
}
