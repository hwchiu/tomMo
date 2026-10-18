import { HandoffList } from "@/components/handoff-views";
import { one } from "@/lib/search";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <HandoffList status={one(query.status)} factoryId={one(query.factory)} />;
}
