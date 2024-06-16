"use client";

import { Skeleton } from "@/components/ui/skeleton";

export const SearchSkeleton = () => {
  return (
    <div>
      <Skeleton className="h-6 w-48" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="w-[calc(50%-0.5rem)] p-2 md:w-[calc(25%-0.5rem)]"
            key={index}
          >
            <div className="flex-1">
              <div className="pt-2">
                <Skeleton className="mb-2 h-6" />
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
