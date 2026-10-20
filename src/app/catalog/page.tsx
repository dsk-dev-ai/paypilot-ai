import { DEMO_CATALOG } from "@/modules/catalog/data";
import { formatCurrency } from "@/lib/calculations";

export default function CatalogPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Product Catalog</h2>
      <p className="text-sm text-gray-600">Demo data (not from external providers)</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_CATALOG.map((p) => (
          <div key={p.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="font-medium">{p.name}</h3>
            <p className="text-sm text-gray-600">{p.description}</p>
            <div className="mt-2 text-sm">{formatCurrency(p.price)}</div>
            <div className="mt-1 text-xs text-gray-500">Category: {p.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
