import { Icon } from "./Icon";

/** Carta boca abajo con número. */
export function CardBack({ n, selected, voted, onClick, disabled, dealt = 0 }: { n: number; selected?: boolean; voted?: boolean; onClick?: () => void; disabled?: boolean; dealt?: number }) {
  const cls = `card-back${selected ? " is-selected" : ""}${voted ? " is-voted" : ""}`;
  const label = `Carta ${n}${selected ? ", elegida" : ""}${voted ? ", tu voto" : ""}`;
  const inner = (
    <>
      <span className="card-corner tl">{n}</span>
      <span className="card-num">{n}</span>
      <span className="card-corner br">{n}</span>
      {(selected || voted) && <span className="card-tag"><Icon name="check" size={14} />{voted ? "Tu voto" : "Elegida"}</span>}
    </>
  );
  const style = { ["--i" as string]: dealt } as React.CSSProperties;
  const move = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 12}deg`);
    e.currentTarget.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
  };
  const leave = (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.style.removeProperty("--rx"); e.currentTarget.style.removeProperty("--ry"); };
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} onPointerMove={move} onPointerLeave={leave} disabled={disabled} aria-label={label} aria-pressed={!!selected}>{inner}</button>
  ) : (
    <div className={cls} style={style} role="img" aria-label={label}>{inner}</div>
  );
}

export function JokerChip({ type }: { type: "pass" | "bounce" }) {
  return (
    <span className={`joker joker-${type}`}>
      <Icon name={type === "pass" ? "swap" : "star"} size={16} />
      {type === "pass" ? "Pasar el reto" : "Rebote"}
    </span>
  );
}

export const JOKER_INFO = {
  pass: "Elegís a otra persona y le pasás el reto. Se gasta al usarlo. No se lo podés pasar a alguien que ya lo tuvo en este turno.",
  bounce: "Si te pasaron un reto, se lo devolvés a quien te lo pasó y lo hacen juntos. Corta la cadena de pases. Se gasta al usarlo.",
} as const;

export function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  const colors = ["#FF6B6B", "#FFD166", "#FFF4E6", "#7EE0B5", "#B79CFF"];
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((i) => (
        <i key={i} style={{ ["--x" as string]: `${(i * 37) % 100}%`, ["--d" as string]: `${(i % 7) * 0.08}s`, ["--r" as string]: `${(i * 53) % 360}deg`, ["--dx" as string]: `${((i * 29) % 80) - 40}px`, background: colors[i % colors.length] }} />
      ))}
    </div>
  );
}
