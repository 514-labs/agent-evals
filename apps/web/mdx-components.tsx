import type { MDXComponents } from "mdx/types"

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1
        className="font-[family-name:var(--font-display)] text-3xl md:text-4xl tracking-tight uppercase leading-[0.9] mt-12 mb-4 first:mt-0 scroll-mt-24"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="font-[family-name:var(--font-display)] text-2xl md:text-3xl tracking-tight uppercase leading-[0.95] mt-10 mb-3 pt-6 border-t-2 border-border/15 scroll-mt-24"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="font-bold text-[14px] uppercase tracking-widest mt-8 mb-2 scroll-mt-24"
        {...props}
      />
    ),
    h4: (props) => (
      <h4
        className="font-bold text-[13px] uppercase tracking-wide mt-6 mb-2 text-muted-foreground scroll-mt-24"
        {...props}
      />
    ),
    p: (props) => (
      <p className="text-[14px] leading-[1.8] text-foreground/80 mb-4 max-w-[65ch]" {...props} />
    ),
    a: (props) => (
      <a
        className="text-foreground font-bold border-b-2 border-accent hover:bg-accent hover:text-accent-foreground transition-colors"
        {...props}
      />
    ),
    ul: (props) => (
      <ul className="mb-4 space-y-1.5 max-w-[65ch]" {...props} />
    ),
    ol: (props) => (
      <ol className="mb-4 space-y-1.5 list-decimal pl-6 max-w-[65ch]" {...props} />
    ),
    li: (props) => (
      <li className="text-[14px] leading-[1.7] text-foreground/80 pl-1 before:content-['—'] before:mr-2 before:text-muted-foreground before:font-bold" {...props} />
    ),
    blockquote: (props) => (
      <blockquote
        className="border-l-4 border-accent pl-5 my-6 py-1"
        {...props}
      />
    ),
    code: (props) => {
      const isBlock = typeof props.className === "string" && props.className.includes("language-")
      if (isBlock) {
        return (
          <code className={`block text-[13px] leading-[1.7] ${props.className ?? ""}`} {...props} />
        )
      }
      return (
        <code className="text-[13px] bg-muted border border-border/15 px-1.5 py-0.5 font-[family-name:var(--font-body)]" {...props} />
      )
    },
    pre: (props) => (
      <pre className="bg-primary text-primary-foreground border-[3px] border-border p-5 my-6 overflow-x-auto text-[13px] leading-[1.7] font-[family-name:var(--font-body)]" {...props} />
    ),
    table: (props) => (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-2 border-border text-[13px]" {...props} />
      </div>
    ),
    thead: (props) => (
      <thead className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em]" {...props} />
    ),
    th: (props) => (
      <th className="px-4 py-2 text-left" {...props} />
    ),
    td: (props) => (
      <td className="px-4 py-3 border-t border-border/15 text-foreground/70" {...props} />
    ),
    hr: () => (
      <hr className="my-10 border-t-[3px] border-border" />
    ),
    strong: (props) => (
      <strong className="font-bold text-foreground" {...props} />
    ),
    ...components,
  }
}
