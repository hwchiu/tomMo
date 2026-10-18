"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HandoffList } from "@/components/handoff-views";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HandoffQuery />
    </Suspense>
  );
}

function HandoffQuery() {
  const query = useSearchParams();
  return <HandoffList status={query.get("status") ?? ""} factoryId={query.get("factory") ?? ""} />;
}
