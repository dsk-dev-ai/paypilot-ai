"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ReturnContent() {
  const params = useSearchParams();
  const orderId = params.get("token") || params.get("orderId");
  const [status, setStatus] = useState<string>("loading");
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    async function capture() {
      if (!orderId) { setStatus("missing_order"); return; }
      try {
        const res = await fetch("/api/orders/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
        const data = await res.json();
        if (!res.ok) { setStatus("error"); setResult(data); return; }
        setStatus(data.alreadyCaptured ? "already_captured" : "captured");
        setResult(data);
      } catch (e: unknown) {
        setStatus("error");
        setResult({ error: e instanceof Error ? e.message : "Failed" });
      }
    }
    capture();
  }, [orderId]);

  return (
    <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur space-y-3">
      {status==="loading" && <p className="text-sm text-[#9aa3c0]">Verifying and capturing payment...</p>}
      {status==="captured" && <><p className="text-sm text-green-400 font-medium">Payment completed (Sandbox)</p><p className="text-sm text-[#9aa3c0]">Captured after approval and server verification.</p></>}
      {status==="already_captured" && <><p className="text-sm text-green-400 font-medium">Order already completed</p></>}
      {status==="error" && <><p className="text-sm text-red-400 font-medium">Verification failed</p><p className="text-sm text-[#9aa3c0]">{typeof result==="object"&&result&&"error" in result ? String((result as Record<string,unknown>).error):"Failed"}</p></>}
      {status==="missing_order" && <p className="text-sm text-red-400">Missing order token</p>}
      {orderId && <p className="text-xs text-[#9aa3c0]">PayPal Order ID: {orderId}</p>}
      <div className="flex gap-2"><Link href="/orders" className="rounded-lg border border-[#20284a] px-3 py-1.5 text-sm text-white">Orders</Link><Link href="/" className="rounded-lg border border-[#20284a] px-3 py-1.5 text-sm text-white">Dashboard</Link></div>
    </div>
  );
}

export default function CheckoutReturnPage() {
  return <div className="space-y-4"><div><h2 className="text-2xl font-semibold tracking-tight text-white">Payment Return</h2><p className="text-sm text-[#9aa3c0]">Status verified server-side.</p></div><Suspense fallback={<div className="text-sm text-[#9aa3c0]">Loading...</div>}><ReturnContent/></Suspense></div>;
}
