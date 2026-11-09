import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Card";
import { StoreGrid } from "@/components/store/StoreGrid";
import { getCatalogProduct } from "@/lib/catalog/products";

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getCatalogProduct(id);
  if (!product) notFound();

  return (
    <div className="space-y-7 animate-fade-up">
      <SectionTitle
        title={product.title}
        subtitle={product.tagline}
        right={
          <ButtonLink href="/store" size="sm" variant="secondary">
            Back to store
          </ButtonLink>
        }
      />
      <StoreGrid products={[product]} />
    </div>
  );
}
