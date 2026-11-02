const P: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  sound: "M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12",
  mute: "M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6",
  motion: "M3 12h4l3-7 4 14 3-7h4",
  history: "M4 5v5h5M5.5 15a8 8 0 105-9.5L4 10M12 8v4l3 2",
  menu: "M4 7h16M4 12h16M4 17h16",
  copy: "M9 9h10v11H9zM5 15V4h10",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z",
  cards: "M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM12 8l3 4-3 4-3-4z",
  pause: "M8 5v14M16 5v14",
  play: "M7 4l13 8-13 8z",
  dot: "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  user: "M12 4a4 4 0 100 8 4 4 0 000-8zM4 20c0-4 4-6 8-6s8 2 8 6",
  swap: "M7 7h13l-4-4M17 17H4l4 4",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  gift: "M4 11h16v9H4zM3 8h18v3H3zM12 8v12M12 8C9 8 8 4 10.5 4S12 8 12 8zm0 0c3 0 4-4 1.5-4S12 8 12 8z",
};
export function Icon({ name, size = 20 }: { name: keyof typeof P; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={`ic ic-${name}`}>
      <path d={P[name]} />
    </svg>
  );
}
