import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="space-y-4">
      <div><h2 className="text-2xl font-semibold tracking-tight text-white">Payment Cancelled</h2><p className="text-sm text-[#9aa3c0]">No payment was captured.</p></div>
      <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur flex gap-2">
        <Link href="/checkout" className="rounded-lg bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] px-3 py-1.5 text-sm text-white">Back to Checkout</Link>
        <Link href="/" className="rounded-lg border border-[#20284a] px-3 py-1.5 text-sm text-white">Dashboard</Link>
      </div>
    </div>
  );
}
