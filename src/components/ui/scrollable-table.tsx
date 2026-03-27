import { useRef, useState, useEffect, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScrollableTableProps {
  children: ReactNode;
  className?: string;
  /** Total number of columns (excluding frozen ones) to calculate hidden count */
  totalScrollableColumns?: number;
}

export default function ScrollableTable({ children, className = "", totalScrollableColumns }: ScrollableTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState(0);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);

    // Estimate hidden columns
    if (totalScrollableColumns && totalScrollableColumns > 0) {
      const overflowWidth = scrollWidth - clientWidth;
      if (overflowWidth <= 0) {
        setHiddenColumns(0);
      } else {
        const avgColWidth = scrollWidth / (totalScrollableColumns + 3); // +3 for frozen cols estimate
        const visibleScrollable = Math.floor(clientWidth / avgColWidth);
        const hidden = Math.max(0, totalScrollableColumns + 3 - visibleScrollable);
        // Adjust based on scroll position
        const scrollRatio = scrollLeft / overflowWidth;
        const rightHidden = Math.max(0, Math.round(hidden * (1 - scrollRatio)));
        setHiddenColumns(rightHidden);
      }
    }
  }, [totalScrollableColumns]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const animRef = useRef<number | null>(null);
  const SPEED = 8; // px per frame

  const startScroll = (direction: "left" | "right") => {
    stopScroll();
    const step = direction === "right" ? SPEED : -SPEED;
    const tick = () => {
      scrollRef.current?.scrollBy({ left: step });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const stopScroll = () => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  };

  useEffect(() => () => stopScroll(), []);

  return (
    <div className={className}>
      {/* Navigation bar */}
      <div className="flex items-center justify-end gap-1.5 mb-1.5">
        {hiddenColumns > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground font-normal">
            + {hiddenColumns} colunas →
          </Badge>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          disabled={!canScrollLeft}
          onMouseDown={() => startScroll("left")}
          onMouseUp={stopScroll}
          onMouseLeave={stopScroll}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          disabled={!canScrollRight}
          onMouseDown={() => startScroll("right")}
          onMouseUp={stopScroll}
          onMouseLeave={stopScroll}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Scrollable container */}
      <div ref={scrollRef} className="overflow-x-auto overflow-y-auto max-h-[75vh] border rounded-md scrollbar-thin">
        {children}
      </div>
    </div>
  );
}
