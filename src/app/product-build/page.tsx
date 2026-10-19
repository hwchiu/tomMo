"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProductBuildView } from "@/components/product-build-view";
import { rangeFromQuery } from "@/domain/schedule";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BuildQuery />
    </Suspense>
  );
}

function BuildQuery() {
  const query = useSearchParams();
  const range = rangeFromQuery(query.get("from") ?? "", query.get("to") ?? "", query.get("month") ?? "");
  return (
    <ProductBuildView
      category={query.get("category") ?? ""}
      region={query.get("region") ?? ""}
      technology={query.get("technology") ?? ""}
      onlyExceptions={query.get("exceptions") === "1"}
      reason={query.get("reason") ?? ""}
      from={range.from}
      to={range.to}
    />
  );
}
