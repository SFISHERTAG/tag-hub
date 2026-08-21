import Link from "next/link";

export function CustomizeButton() {
  return (
    <Link
      href="/dashboard/customize"
      className="inline-flex items-center gap-2 rounded-md border border-chrome-line bg-chrome px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-chrome-hover"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      </svg>
      Customize
    </Link>
  );
}
