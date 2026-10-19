import Image from "next/image";
import { cn } from "@/lib/utils";

export type LogoSize = "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Visual container sizes. The image is rendered larger than the container
 * and scaled down so the logo mark fills the space — compensating for
 * whitespace baked into formalogo.png.
 */
const CONTAINER_MAP: Record<LogoSize, string> = {
  sm:  "size-9",    //  36px  — nav icon
  md:  "size-12",   //  48px  — avatar row
  lg:  "size-20",   //  80px  — sidebar header
  xl:  "size-24",   //  96px
  "2xl": "size-32", // 128px  — hero / splash
};

const PIXEL_MAP: Record<LogoSize, number> = {
  sm: 36,
  md: 48,
  lg: 80,
  xl: 96,
  "2xl": 128,
};

export function Logo({
  className,
  size = "lg",
  priority = true,
}: {
  className?: string;
  size?: LogoSize;
  priority?: boolean;
}) {
  const px = PIXEL_MAP[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        CONTAINER_MAP[size],
        className
      )}
    >
      <Image
        src="/formalogo.png"
        alt="Forma"
        width={px * 2}
        height={px * 2}
        priority={priority}
        className="h-full w-full scale-[1.35] object-contain transition-transform duration-200 hover:scale-[1.45]"
      />
    </span>
  );
}
