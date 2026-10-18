import { IssueList } from "@/components/issue-views";
import { one } from "@/lib/search";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <IssueList
      factoryId={one(query.factory)}
      severity={one(query.severity)}
      status={one(query.status)}
      overdue={one(query.overdue) === "1"}
    />
  );
}
