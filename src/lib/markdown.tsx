import { Fragment, type ReactNode } from "react";

// Markdown mínimo para los textos editables (títulos ##, párrafos, listas, tablas, **negrita**, [links](url)).
// Se renderiza a elementos de React, sin HTML crudo.

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      out.push(<strong key={`${keyBase}-b${i++}`}>{token.slice(2, -2)}</strong>);
    } else {
      const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        const href = lm[2];
        const safe = /^(https?:\/\/|\/|mailto:|tel:)/.test(href) ? href : "#";
        const external = safe.startsWith("http");
        out.push(
          <a key={`${keyBase}-a${i++}`} href={safe} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
            {lm[1]}
          </a>,
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = "prose-inedita" }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (line.startsWith("## ") || line.startsWith("# ")) {
      blocks.push(<h2 key={k++}>{inline(line.replace(/^#+\s*/, ""), `h${k}`)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={k++} className="overflow-x-auto">
          <table>
            {head ? (
              <thead>
                <tr>
                  {head.map((c, ci) => (
                    <th key={ci}>{c}</th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{inline(c, `t${ri}${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={k++}>
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `l${k}${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||[-*]\s)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(<p key={k++}>{inline(para.join(" "), `p${k}`)}</p>);
  }
  return (
    <div className={className}>
      {blocks.map((b, bi) => (
        <Fragment key={bi}>{b}</Fragment>
      ))}
    </div>
  );
}

/** Devuelve solo la sección "## Título" que coincida (para mostrar la guía de talles que corresponde). */
export function markdownSection(source: string, match: RegExp): string | null {
  const parts = source.split(/\n(?=## )/);
  const found = parts.find((p) => match.test(p.split("\n")[0]));
  return found ?? null;
}
