import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          PayPilot AI combines intelligent shopping, budget-aware planning, and verified PayPal Sandbox payments.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/assistant"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Shopping Assistant
          </Link>
          <Link
            href="/catalog"
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Product Catalog
          </Link>
          <Link
            href="/orders"
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Orders
          </Link>
        </div>
      </section>
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-base font-medium">Day 1 Status</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Responsive dashboard shell implemented</li>
          <li>Typed product catalog with demo data</li>
          <li>Shopping assistant UI (budget-aware planning)</li>
          <li>Deterministic calculations and order validation</li>
          <li>Typed order states and transitions</li>
          <li>Basic tests added (calculations)</li>
          <li>.env.example and README updates pending</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500">PayPal integration not yet implemented or tested.</p>
      </section>
    </div>
  );
}
