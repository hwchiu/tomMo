import { FactoryView } from "@/components/factory-view";
import { factoryParams } from "@/lib/static-params";

export function generateStaticParams() {
  return factoryParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FactoryView id={id} />;
}
