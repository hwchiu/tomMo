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
      productId={query.get("product") ?? ""}
      featureId={query.get("feature") ?? ""}
      onlyChanges={query.get("changes") === "1"}
      adhocOnly={query.get("adhoc") === "1"}
    />
  );
}
