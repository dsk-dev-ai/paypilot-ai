"use client";

import { useEffect, useState } from "react";

export default function StatusPage() {
  const [data, setData] = useState<any>(null);
  useEffect(()=>{
    fetch("/api/health").then(r=>r.json()).then(setData).catch(()=>{});
  },[]);
  return (
    <div className="space-y-4">
      <div><h2 className="text-2xl font-semibold tracking-tight text-white">Integrations Status</h2><p className="text-sm text-[#9aa3c0]">Server-side configuration only. Values not displayed.</p></div>
      <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur">
        <pre className="text-xs text-[#e6e8ee] overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
