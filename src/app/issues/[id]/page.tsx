import { IssueDetail } from "@/components/issue-views";
import { issueParams } from "@/lib/static-params";

export function generateStaticParams() {
  return issueParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IssueDetail id={id} />;
}
