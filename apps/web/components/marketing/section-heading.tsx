interface SectionHeadingProps {
  number: number;
  title: string;
}

export function SectionHeading({ number, title }: SectionHeadingProps) {
  return (
    <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-[29px] text-[color:var(--foreground)]">
      &sect;{number} {title}
    </h2>
  );
}
