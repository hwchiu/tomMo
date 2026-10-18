import { PlanForm } from "@/components/plan-form";
import { planParams } from "@/lib/static-params";

export function generateStaticParams() {
  return planParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string; productId: string }> }) {
  const { id, productId } = await params;
  return <PlanForm factoryId={id} productId={productId} />;
}
