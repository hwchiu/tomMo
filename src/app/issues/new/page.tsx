import { IssueCreate } from "@/components/issue-views";
import { one } from "@/lib/search";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <IssueCreate factoryId={one(query.factory)} />;
}
