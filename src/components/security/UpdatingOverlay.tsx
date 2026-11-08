import { RefreshCw } from "lucide-react";

export function UpdatingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#02182c]/85 px-5 backdrop-blur-sm"
      role="status"
      aria-live="assertive"
    >
      <div className="text-center">
        <RefreshCw className="mx-auto animate-spin text-sky-300" size={32} />
        <p className="mt-4 font-medium text-white">Updating security…</p>
        <p className="mt-2 text-sm text-slate-300">
          This may take a moment. Please wait.
        </p>
      </div>
    </div>
  );
}
