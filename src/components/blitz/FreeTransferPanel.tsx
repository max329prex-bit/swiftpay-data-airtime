export default function FreeTransferPanel() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] px-6 py-12 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5m4 0H9" />
        </svg>
      </div>

      <span className="text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full">
        Coming Soon
      </span>

      <h2 className="text-xl font-bold text-white">Free Transfer</h2>

      <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
        This feature is currently unavailable.{" "}
        <span className="text-white font-semibold">Please use your Permanent Account</span>{" "}
        to deposit funds for now.
      </p>

      <p className="text-xs text-gray-500 mt-2">We&apos;ll notify you once it&apos;s back 🚀</p>
    </div>
  );
}
