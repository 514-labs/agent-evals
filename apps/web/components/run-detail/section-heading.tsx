import { cn } from "@workspace/ui/lib/utils";

interface SectionHeadingProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function SectionHeading({ children, id, className }: SectionHeadingProps) {
  return (
    <h2
      id={id}
      className={cn(
        "font-[family-name:var(--font-display)] text-[22px] font-semibold leading-[1.2] tracking-tight scroll-mt-16",
        className,
      )}
    >
      {children}
    </h2>
  );
}

interface SectionDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionDescription({ children, className }: SectionDescriptionProps) {
  return (
    <p
      className={cn(
        "font-[family-name:var(--font-display)] text-sm leading-[1.65] text-muted-foreground max-w-[782px]",
        className,
      )}
    >
      {children}
    </p>
  );
}
