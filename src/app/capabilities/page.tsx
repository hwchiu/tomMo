"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CapabilityView } from "@/components/capability-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CapabilityQuery />
    </Suspense>
  );
}

function CapabilityQuery() {
  const query = useSearchParams();
  return (
    <CapabilityView
      factoryId={query.get("factory") ?? ""}
      platformId={query.get("platform") ?? ""}
      featureId={query.get("feature") ?? ""}
    />
  );
}
