"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old bookmarks. The Go server answers this path with 308 before the file is served. */
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <p className="text-sm text-muted">
      這個頁面已移除。
      <a className="ml-1 underline" href="../">回到總覽</a>
    </p>
  );
}
