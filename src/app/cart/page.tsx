"use client";

import Link from "next/link";

export default function CartPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Cart</h2>
        <p className="text-sm text-gray-600">Review items before checkout</p>
      </div>
      <div className="rounded-lg border bg-white p-6 shadow-sm space-y-2">
        <p className="text-sm text-gray-700">Use the Shopping Assistant or Catalog to build your order, then proceed to Checkout.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/assistant" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">Shopping Assistant</Link>
          <Link href="/catalog" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Catalog</Link>
          <Link href="/checkout" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Checkout</Link>
        </div>
      </div>
    </div>
  );
}
