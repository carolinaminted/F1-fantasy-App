
import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-pure-white/5 rounded ${className}`} />
);

export const AppSkeleton: React.FC = () => (
  <div className="min-h-screen bg-carbon-black flex flex-col md:flex-row text-ghost-white">
    {/* Sidebar Skeleton (Desktop) */}
    <div className="hidden md:flex flex-col w-64 p-4 border-r border-accent-gray gap-6 h-screen">
       <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-6 w-32" />
       </div>
       {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
       <div className="mt-auto pt-4 border-t border-accent-gray/50">
          <Skeleton className="h-6 w-24" />
       </div>
    </div>
    
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Skeleton (Mobile) */}
        <div className="md:hidden p-4 border-b border-accent-gray flex justify-between items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-16" />
        </div>

        <div className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto">
            {/* Hero Skeleton */}
            <Skeleton className="h-64 w-full rounded-2xl" />
            
            {/* Grid Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
            
            {/* Grid Content Row 2 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
        </div>

        {/* Bottom Nav Skeleton (Mobile) */}
        <div className="md:hidden h-20 bg-carbon-black border-t border-accent-gray grid grid-cols-4 gap-4 p-4 pb-safe">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-8 mx-auto rounded-full" />)}
        </div>
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number; height?: string }> = ({ rows = 5, height = "h-16" }) => (
  <div className="space-y-3 w-full animate-fade-in">
    {[...Array(rows)].map((_, i) => (
      <Skeleton key={i} className={`${height} w-full rounded-lg`} />
    ))}
  </div>
);

export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
    {[...Array(count)].map((_, i) => (
      <Skeleton key={i} className="h-32 w-full rounded-xl" />
    ))}
  </div>
);

export const ProfileSkeleton: React.FC = () => (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center gap-4 py-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
             {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-96 w-full rounded-lg" />
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
        </div>
    </div>
);
