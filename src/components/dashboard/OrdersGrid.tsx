"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import { colorSchemeDark, themeQuartz, type ColDef, type RowClickedEvent } from "ag-grid-community";
import { formatMinor } from "@/lib/money-format";

export type OrderRow = {
  id: string;
  shortId: string;
  state: string;
  totalMinor: number;
  currency: string;
  items: number;
  providers: string;
  fulfillment: string;
  createdAt: string;
};

const gridTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  accentColor: "#6d8dff",
  backgroundColor: "#0a0e18",
  foregroundColor: "#eef1f8",
  borderColor: "rgba(255,255,255,0.08)",
  headerBackgroundColor: "#0d1322",
  headerTextColor: "#8b93ad",
  oddRowBackgroundColor: "rgba(255,255,255,0.02)",
  rowHoverColor: "rgba(109,141,255,0.10)",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  fontSize: "12px",
});

export function OrdersGrid({ rows }: { rows: OrderRow[] }) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<OrderRow>[]>(
    () => [
      { field: "shortId", headerName: "Order", minWidth: 120, flex: 1 },
      {
        field: "state",
        headerName: "State",
        minWidth: 110,
        cellStyle: (params) => {
          const state = params.value as string;
          const color =
            state === "PAID"
              ? "#34d399"
              : state === "FAILED" || state === "CANCELED"
                ? "#fb7185"
                : "#fbbf24";
          return { color, fontWeight: 600 };
        },
      },
      {
        field: "totalMinor",
        headerName: "Total",
        minWidth: 110,
        valueFormatter: (params) => formatMinor(params.value as number, params.data?.currency ?? "USD"),
      },
      { field: "items", headerName: "Lines", minWidth: 90, maxWidth: 100 },
      { field: "providers", headerName: "Merchants", minWidth: 130, flex: 1 },
      { field: "fulfillment", headerName: "Delivery", minWidth: 140, flex: 1 },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 160,
        flex: 1,
        valueFormatter: (params) => new Date(params.value as string).toLocaleString(),
      },
    ],
    []
  );

  return (
    <div className="h-[430px] w-full overflow-hidden rounded-2xl border border-line">
      <AgGridReact<OrderRow>
        theme={gridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, filter: true, resizable: true }}
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 20, 50]}
        onRowClicked={(event: RowClickedEvent<OrderRow>) => {
          if (event.data) router.push(`/orders/${event.data.id}`);
        }}
        rowStyle={{ cursor: "pointer" }}
        suppressCellFocus
      />
    </div>
  );
}
