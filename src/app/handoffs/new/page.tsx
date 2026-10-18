"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HandoffCreate } from "@/components/handoff-views";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewHandoff />
    </Suspense>
  );
}

function NewHandoff() {
  const query = useSearchParams();
  return <HandoffCreate factoryId={query.get("factory") ?? ""} />;
}
