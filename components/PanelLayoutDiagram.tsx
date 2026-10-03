import type { PanelLayout } from "@/types";

interface Props {
  layout: PanelLayout;
  roofWidthM: number;
  roofLengthM: number;
}

const CORNER_MAP: Record<PanelLayout["reservedCorner"], { rowFromTop: boolean; colFromLeft: boolean }> = {
  "top-left": { rowFromTop: true, colFromLeft: true },
  "top-right": { rowFromTop: true, colFromLeft: false },
  "bottom-left": { rowFromTop: false, colFromLeft: true },
  "bottom-right": { rowFromTop: false, colFromLeft: false },
  none: { rowFromTop: true, colFromLeft: true },
};

export default function PanelLayoutDiagram({ layout, roofWidthM, roofLengthM }: Props) {
  const PADDING = 20;
  const MAX_W = 460;
  const MAX_H = 320;
  const scale = Math.min(MAX_W / roofWidthM, MAX_H / roofLengthM);
  const roofW = roofWidthM * scale;
  const roofH = roofLengthM * scale;
  const viewW = roofW + PADDING * 2;
  const viewH = roofH + PADDING * 2;

  const cellW = roofW / layout.columns;
  const cellH = roofH / layout.rows;
  const { rowFromTop, colFromLeft } = CORNER_MAP[layout.reservedCorner];

  const isReserved = (row: number, col: number) => {
    if (layout.reservedCorner === "none") return false;
    const rowInReservedBand = rowFromTop ? row < layout.reservedRows : row >= layout.rows - layout.reservedRows;
    const colInReservedBand = colFromLeft ? col < layout.reservedColumns : col >= layout.columns - layout.reservedColumns;
    return rowInReservedBand && colInReservedBand;
  };

  const cells: { row: number; col: number; reserved: boolean }[] = [];
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.columns; c++) {
      cells.push({ row: r, col: c, reserved: isReserved(r, c) });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="mx-auto w-full max-w-md"
      role="img"
      aria-label="تخطيط توزيع الألواح على السطح"
    >
      <rect
        x={PADDING}
        y={PADDING}
        width={roofW}
        height={roofH}
        fill="var(--color-surface-2)"
        stroke="var(--color-border)"
        strokeWidth={2}
        rx={4}
      />
      {cells.map(({ row, col, reserved }) => (
        <rect
          key={`${row}-${col}`}
          x={PADDING + col * cellW + 1.5}
          y={PADDING + row * cellH + 1.5}
          width={cellW - 3}
          height={cellH - 3}
          rx={2}
          fill={reserved ? "var(--color-surface)" : "var(--color-accent)"}
          stroke={reserved ? "var(--color-border)" : "var(--color-accent-2)"}
          strokeWidth={1}
          opacity={reserved ? 0.4 : 0.85}
        />
      ))}
      <text
        x={viewW / 2}
        y={viewH - 4}
        textAnchor="middle"
        fontSize={11}
        fill="var(--color-text-muted)"
      >
        {roofWidthM} م × {roofLengthM} م
      </text>
    </svg>
  );
}
