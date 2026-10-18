import { PortfolioView } from "@/components/portfolio-view";
import { one } from "@/lib/search";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <PortfolioView
      category={one(query.category)}
      region={one(query.region)}
      technology={one(query.technology)}
      status={one(query.status)}
      group={one(query.group)}
    />
  );
}
