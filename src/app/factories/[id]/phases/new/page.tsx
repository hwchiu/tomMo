import { PhaseForm } from "@/components/entity-forms";
import { factoryParams } from "@/lib/static-params";

export function generateStaticParams() {
  return factoryParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhaseForm factoryId={id} />;
}
