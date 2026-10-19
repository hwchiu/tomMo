"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { audienceFilter } from "@/domain/audience";
import { ProductBuildView } from "@/components/product-build-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BuildQuery />
    </Suspense>
  );
}

function BuildQuery() {
  const query = useSearchParams();
  return (
    <ProductBuildView
      category={query.get("category") ?? ""}
      region={query.get("region") ?? ""}
      audience={audienceFilter(query.get("audience"))}
      onlyExceptions={query.get("exceptions") === "1"}
    />
  );
}
