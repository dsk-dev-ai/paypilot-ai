"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";

type Order = { id: string; ppOrderId?: string; total: number; currency: string; state: string; createdAt: string };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/orders/list");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        setOrders(data.orders || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">Orders</h2>
        <p className="text-sm text-[#9aa3c0]">In-memory only (not persisted across restarts). Status verified server-side.</p>
      </div>
      <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur">
        {loading && <p className="text-sm text-[#9aa3c0]">Loading...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && orders.length===0 && <p className="text-sm text-[#9aa3c0]">No orders in this session.</p>}
        {orders.length>0 && (
          <div className="space-y-3">
            {orders.map(o=>(
              <div key={o.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-[#20284a] bg-[#0f152b]/60 p-3">
                <div>
                  <div className="text-sm font-medium text-white">Order {o.id.slice(0,8)}</div>
                  <div className="text-xs text-[#9aa3c0]">{new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.state} />
                  <div className="text-sm text-white">{o.currency} {o.total.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
