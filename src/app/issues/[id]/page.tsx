import { IssueDetail } from "@/components/issue-views";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IssueDetail id={id} />;
}
