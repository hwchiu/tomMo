"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old bookmarks. The Go server answers this path with 308 before the file is served. */
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin");
  }, [router]);
  return (
    <p className="text-sm text-muted">
      設定已併入管理。
      <a className="ml-1 underline" href="../admin/">前往管理</a>
    </p>
  );
}
