import Link from "next/link"
import { FileQuestion } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-6">
      <div className="text-center max-w-[400px]">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-surface-secondary flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-10 h-10 text-ink-tertiary" strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <p className="font-body text-sm font-semibold text-ink-tertiary uppercase tracking-widest mb-3">
          404
        </p>
        <h1 className="font-display font-bold text-[2rem] text-ink-primary leading-tight">
          Page not found
        </h1>
        <p className="font-body text-sm text-ink-secondary mt-3 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold font-body text-sm hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </Link>
          <Link
            href="javascript:history.back()"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-xl border border-border-default text-sm font-medium font-body text-ink-secondary hover:border-primary-500 hover:text-primary-500 transition-colors"
          >
            Go Back
          </Link>
        </div>
      </div>
    </div>
  )
}
