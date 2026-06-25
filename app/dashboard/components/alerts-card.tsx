import { DashboardCard } from "./ui/dashboard-card";

export function AlertsCard() {
  return (
    <DashboardCard
      title="Alerts"
      variant="teal"
      rightSlot={
        <button
          type="button"
          className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10"
        >
          + Create
        </button>
      }
    >
      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="grid grid-cols-12 gap-2 bg-[#183d46] px-3 py-2 text-xs font-semibold text-[#9cd3e0]">
          <div className="col-span-2">Enable</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Frequency</div>
          <div className="col-span-5">Description</div>
        </div>

        <div className="grid grid-cols-12 gap-2 border-t border-white/10 bg-[#1f4e58] px-3 py-3 text-xs text-white">
          <div className="col-span-2">✓</div>
          <div className="col-span-3 font-medium">GLP-1 Volume Threshold</div>
          <div className="col-span-2">
            <span className="rounded bg-[#86efac] px-2 py-0.5 text-[10px] font-bold text-emerald-900">
              Monthly
            </span>
          </div>
          <div className="col-span-5 text-white/90">
            Trigger if GLP-1 total volume exceeds 5000 in any month.
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
