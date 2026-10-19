"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ManageView, manageSection } from "@/components/manage-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageQuery />
    </Suspense>
  );
}

function ManageQuery() {
  const query = useSearchParams();
  return <ManageView section={manageSection(query.get("section"))} />;
}
