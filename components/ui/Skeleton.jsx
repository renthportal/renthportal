'use client'

export const SkeletonPulse = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
)

export const SkeletonStats = ({ count = 4 }) => (
  <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4 lg:gap-6`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 lg:p-6">
        <SkeletonPulse className="w-12 h-12 rounded-xl mb-4" />
        <SkeletonPulse className="w-20 h-8 mb-2" />
        <SkeletonPulse className="w-28 h-4" />
      </div>
    ))}
  </div>
)

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div className="p-4 border-b border-gray-100"><SkeletonPulse className="w-32 h-5" /></div>
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-6 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonPulse key={c} className={`h-4 ${c === 0 ? 'w-32' : 'w-20'} flex-shrink-0`} />
          ))}
        </div>
      ))}
    </div>
  </div>
)

export const SkeletonCards = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <SkeletonPulse className="w-full h-40" />
        <div className="p-4 space-y-3">
          <SkeletonPulse className="w-3/4 h-5" />
          <SkeletonPulse className="w-1/2 h-4" />
          <div className="grid grid-cols-3 gap-2">
            <SkeletonPulse className="h-12 rounded-lg" />
            <SkeletonPulse className="h-12 rounded-lg" />
            <SkeletonPulse className="h-12 rounded-lg" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// PAGINATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════


