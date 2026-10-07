import { Markdown } from "@/lib/markdown";

export function ContentPage({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[760px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      <h1 className="text-[13px] font-medium uppercase tracking-[0.24em] sm:text-sm">{title}</h1>
      <div className="mt-8">
        <Markdown source={body} />
      </div>
      {children}
    </div>
  );
}
