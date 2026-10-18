import { PlanForm } from "@/components/plan-form";
import { planParams } from "@/lib/static-params";

export function generateStaticParams() {
  return planParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string; platformId: string }> }) {
  const { id, platformId } = await params;
  return <PlanForm factoryId={id} platformId={platformId} />;
}
