interface SideNoteProps {
  children: string;
}

export function SideNote({ children }: SideNoteProps) {
  return (
    <div className="w-full mt-4 2xl:absolute 2xl:right-[-244px] 2xl:top-0 2xl:w-[200px] 2xl:mt-0">
      <div className="bg-[color:var(--secondary)] border border-[color:var(--secondary)] p-[20px] flex flex-col gap-[6px]">
        <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
          Note
        </span>
        <p className="font-[family-name:var(--font-display)] text-[11.2px] italic leading-[17.36px] text-[color:var(--muted-foreground)]">
          {children}
        </p>
      </div>
    </div>
  );
}
