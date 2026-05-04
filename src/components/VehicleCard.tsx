"use client";

import { Vehicle, vehicleTypeLabel } from "@/lib/supabase";

const typeEmoji: Record<string, string> = {
  bus: "🚌",
  van: "🚐",
  sedan: "🚗",
  suv: "🚙",
  truck: "🚛",
};

interface VehicleCardProps {
  vehicle: Vehicle;
  selected?: boolean;
  onSelect: (vehicle: Vehicle) => void;
}

export default function VehicleCard({ vehicle, selected, onSelect }: VehicleCardProps) {
  return (
    <button
      onClick={() => onSelect(vehicle)}
      disabled={!vehicle.available}
      className={`card w-full text-left transition-all ${
        selected
          ? "ring-2 ring-primary-500 border-primary-500 bg-primary-50"
          : vehicle.available
          ? "hover:border-gray-300 hover:shadow-md active:scale-[0.98]"
          : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{typeEmoji[vehicle.type] || "🚗"}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 truncate">{vehicle.name}</h3>
            {!vehicle.available && (
              <span className="shrink-0 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                사용불가
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
              {vehicleTypeLabel[vehicle.type] || vehicle.type}
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
              {vehicle.capacity}인승
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
              {vehicle.plate_number}
            </span>
          </div>
          {vehicle.description && (
            <p className="mt-1.5 text-xs text-gray-400">{vehicle.description}</p>
          )}
        </div>
        {selected && (
          <div className="shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
