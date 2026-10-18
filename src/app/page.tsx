"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PortfolioView } from "@/components/portfolio-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PortfolioQuery />
    </Suspense>
  );
}

function PortfolioQuery() {
  const query = useSearchParams();
  return (
    <PortfolioView
      category={query.get("category") ?? ""}
      region={query.get("region") ?? ""}
      technology={query.get("technology") ?? ""}
      status={query.get("status") ?? ""}
      group={query.get("group") ?? ""}
    />
  );
}
