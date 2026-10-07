export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden className="animate-fade-in">
      <div className="px-4 pb-6 pt-8 sm:px-8 sm:pt-12">
        <div className="h-4 w-40 bg-soft" />
      </div>
      <div className="h-12 border-b border-line" />
      <ul className="grid grid-cols-2 gap-x-1 gap-y-8 px-1 pt-1 sm:gap-x-2 sm:px-2 lg:grid-cols-4 lg:gap-x-3 lg:px-3">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i}>
            <div className="aspect-[3/4] bg-soft" />
            <div className="mt-3 h-3 w-3/4 bg-soft" />
            <div className="mt-2 h-3 w-1/3 bg-soft" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div aria-hidden className="grid animate-fade-in lg:grid-cols-[1.4fr_1fr]">
      <div className="aspect-[3/4] bg-soft lg:aspect-auto lg:h-[85vh]" />
      <div className="space-y-4 px-5 py-8 lg:px-12">
        <div className="h-4 w-2/3 bg-soft" />
        <div className="h-4 w-1/4 bg-soft" />
        <div className="h-12 w-full bg-soft" />
      </div>
    </div>
  );
}
