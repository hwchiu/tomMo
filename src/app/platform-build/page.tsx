import { PlatformBuildView } from "@/components/platform-build-view";
import { one } from "@/lib/search";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <PlatformBuildView
      category={one(query.category)}
      region={one(query.region)}
      technology={one(query.technology)}
      onlyExceptions={one(query.exceptions) === "1"}
    />
  );
}
