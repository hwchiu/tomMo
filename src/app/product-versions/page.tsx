"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CapabilityView } from "@/components/capability-view";
import { rangeFromQuery } from "@/domain/schedule";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VersionQuery />
    </Suspense>
  );
}

function VersionQuery() {
  const query = useSearchParams();
  const range = rangeFromQuery(query.get("from") ?? "", query.get("to") ?? "", query.get("month") ?? "");
  return (
    <CapabilityView
      factoryId={query.get("factory") ?? ""}
      productId={query.get("product") ?? ""}
      featureId={query.get("feature") ?? ""}
      onlyChanges={query.get("changes") === "1"}
      adhocOnly={query.get("adhoc") === "1"}
      from={range.from}
      to={range.to}
    />
  );
}
