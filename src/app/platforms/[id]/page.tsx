import { PlatformDetailView } from "@/components/platform-views";
import { platformParams } from "@/lib/static-params";

export function generateStaticParams() {
  return platformParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlatformDetailView id={id} />;
}
