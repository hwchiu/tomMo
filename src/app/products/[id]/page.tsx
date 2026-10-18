import { ProductDetailView } from "@/components/product-views";
import { productParams } from "@/lib/static-params";

export function generateStaticParams() {
  return productParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailView id={id} />;
}
