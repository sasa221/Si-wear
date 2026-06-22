interface ProductGridSkeletonProps {
  count?: number;
  cols?: "1" | "2" | "3";
}

export function ProductGridSkeleton({ count = 8, cols = "3" }: ProductGridSkeletonProps) {
  const gridClass =
    cols === "1"
      ? "grid grid-cols-1 gap-3 sm:gap-4"
      : cols === "2"
        ? "grid grid-cols-2 gap-3 sm:gap-4"
        : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4";

  return (
    <div className={gridClass} aria-label="Loading products">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden bg-[#111] animate-pulse">
          <div className="bg-zinc-900" style={{ aspectRatio: "4/5" }} />
          <div className="p-2.5 sm:p-3">
            <div className="h-3 w-3/4 bg-zinc-800" />
            <div className="mt-2 h-3 w-20 bg-zinc-800" />
            <div className="mt-3 h-7 w-full bg-zinc-900" />
          </div>
        </div>
      ))}
    </div>
  );
}
