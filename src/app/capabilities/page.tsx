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
      phaseId={query.get("phase") ?? ""}
      platformId={query.get("platform") ?? ""}
      versionId={query.get("version") ?? ""}
      featureId={query.get("feature") ?? ""}
      mismatches={query.get("mismatch") === "1"}
    />
  );
}
