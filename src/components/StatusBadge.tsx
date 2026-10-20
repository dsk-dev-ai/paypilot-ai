export default function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "border-gray-300 text-gray-700";
  if (s === "completed") cls = "border-green-300 bg-green-50 text-green-700";
  if (s === "captured" || s === "paid") cls = "border-green-300 bg-green-50 text-green-700";
  if (s === "failed") cls = "border-red-300 bg-red-50 text-red-600";
  if (s === "canceled" || s === "cancelled") cls = "border-gray-400 bg-gray-100 text-gray-700";
  if (s === "pending_approval" || s === "approving" || s === "capturing") cls = "border-blue-300 bg-blue-50 text-blue-700";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}
