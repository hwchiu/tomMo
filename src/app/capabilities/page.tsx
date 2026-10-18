import { CapabilityView } from "@/components/capability-view";
import { one } from "@/lib/search";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <CapabilityView
      factoryId={one(query.factory)}
      phaseId={one(query.phase)}
      platformId={one(query.platform)}
      versionId={one(query.version)}
      featureId={one(query.feature)}
      mismatches={one(query.mismatch) === "1"}
    />
  );
}
