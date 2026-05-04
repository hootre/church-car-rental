import { statusLabel, statusColor } from "@/lib/supabase";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor[status] || "bg-gray-100 text-gray-600"}`}>
      {statusLabel[status] || status}
    </span>
  );
}
