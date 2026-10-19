"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Forward />
    </Suspense>
  );
}

function Forward() {
  const router = useRouter();
  const query = useSearchParams();
  useEffect(() => {
    const qs = query.toString();
    router.replace(qs ? `/product-versions?${qs}` : "/product-versions");
  }, [query, router]);
  return <p className="text-sm text-muted">前往產品版本管理…</p>;
}
