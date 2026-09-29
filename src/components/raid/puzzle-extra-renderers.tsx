"use client";

import { useState } from "react";
import {
  CIRCUIT_SIZE,
  JIGSAW_SIZE,
  circuitCellMask,
  circuitRotateCell,
  circuitSolvedClient,
  jigsawSolved,
  jigsawSwap,
  lockRotateRing,
  lockRotateSolved,
} from "@/lib/raid/puzzle-extra-interactions";

/**
 * W7c — 3 renderer puzzle mới cho PuzzleModal (concept §8.1):
 * - lock-rotate (iron): 3 vòng đồng tâm, click vòng để xoay vạch về đỉnh.
 * - circuit (wood): 4×4 ống nối, click cell xoay 90°, nối A(0,0)→B(3,3).
 * - jigsaw (safe): 4×4 hoán vị, click 2 ô để swap mảnh về đúng chỗ.
 * Client gửi attempt (state hiện tại) — server validate (KHÔNG gửi "solved").
 */

interface RendererProps {
  onSubmit: (attempt: number[]) => void;
  onCancel: () => void;
}

export function LockRotateRenderer({
  offsets,
  sizes,
  onSubmit,
  onCancel,
}: RendererProps & { offsets: number[]; sizes: number[] }) {
  const [offs, setOffs] = useState<number[]>(offsets);
  const solved = lockRotateSolved(offs, sizes);
  // Bán kính 3 vòng (trong-trai) — click vùng vòng để xoay.
  const radii = [22, 36, 50];
  return (
    <div className="w-72 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
      <h3 className="f-display mb-1 text-sm text-[#4e7d3a]">Mở rương — Vòng xoay</h3>
      <p className="mb-3 text-xs text-[#6b5b45]">Click từng vòng để đưa vạch khắc về đỉnh (0)</p>
      <div className="mb-3 flex justify-center">
        <svg width="140" height="140" viewBox="0 0 140 140" data-testid="lock-rings">
          <line x1="70" y1="14" x2="70" y2="30" stroke="#c0452f" strokeWidth="3" />
          {sizes.map((size, i) => {
            const r = radii[i];
            const angle = (offs[i] / size) * 2 * Math.PI - Math.PI / 2;
            const mx = 70 + r * Math.cos(angle);
            const my = 70 + r * Math.sin(angle);
            const ringSolved = ((offs[i] % size) + size) % size === 0;
            return (
              <g
                key={i}
                onClick={() => setOffs((o) => lockRotateRing(o, i, sizes))}
                className="cursor-pointer"
              >
                <circle cx="70" cy="70" r={r} fill="none" stroke="#4a3119" strokeWidth="10" />
                <circle cx="70" cy="70" r={r} fill="none" stroke="#4e7d3a" strokeWidth="2" opacity={ringSolved ? 1 : 0} />
                <line
                  x1={70 + (r - 7) * Math.cos(angle)}
                  y1={70 + (r - 7) * Math.sin(angle)}
                  x2={mx}
                  y2={my}
                  stroke={ringSolved ? "#4e7d3a" : "#c0452f"}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          <circle cx="70" cy="70" r="6" fill="#4a3119" />
        </svg>
      </div>
      <div className="mb-3 text-sm text-[#3b2f23]">
        Vòng: [{offs.map((o, i) => `${o}/${sizes[i]}`).join("  ")}]
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => (solved ? onSubmit(offs) : null)}
          disabled={!solved}
          className="flex-1 rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-3 py-1.5 text-sm text-[#fbf7ec] disabled:opacity-40"
        >
          Mở khóa
        </button>
        <CancelButton onCancel={onCancel} />
      </div>
    </div>
  );
}

export function CircuitRenderer({
  shapes,
  rot,
  onSubmit,
  onCancel,
}: RendererProps & { shapes: number[]; rot: number[] }) {
  const [rots, setRots] = useState<number[]>(rot);
  const solved = circuitSolvedClient(rots, shapes);
  return (
    <div className="w-72 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
      <h3 className="f-display mb-1 text-sm text-[#4e7d3a]">Mở rương — Nối mạch</h3>
      <p className="mb-3 text-xs text-[#6b5b45]">Click ô để xoay ống — nối nước từ A (trên trái) tới B (dưới phải)</p>
      <div className="mb-3 grid grid-cols-4 gap-1" data-testid="circuit-grid">
        {rots.map((r, i) => {
          const mask = circuitCellMask(shapes[i], r);
          const x = i % CIRCUIT_SIZE;
          const y = Math.floor(i / CIRCUIT_SIZE);
          const isA = x === 0 && y === 0;
          const isB = x === CIRCUIT_SIZE - 1 && y === CIRCUIT_SIZE - 1;
          return (
            <button
              key={i}
              onClick={() => setRots((rr) => circuitRotateCell(rr, i))}
              className={`relative h-14 rounded border-2 ${
                isA || isB ? "border-[#4e7d3a] bg-[#e7f0dd]" : "border-[#4a3119] bg-[#f3e8cf]"
              } hover:brightness-110`}
              aria-label={`ô ${x},${y} xoay ${r}`}
            >
              <svg viewBox="0 0 40 40" className="h-full w-full">
                {(mask & 0b0100) !== 0 && <line x1="20" y1="20" x2="20" y2="0" stroke="#4a3119" strokeWidth="6" />}
                {(mask & 0b0010) !== 0 && <line x1="20" y1="20" x2="40" y2="20" stroke="#4a3119" strokeWidth="6" />}
                {(mask & 0b1000) !== 0 && <line x1="20" y1="20" x2="20" y2="40" stroke="#4a3119" strokeWidth="6" />}
                {(mask & 0b0001) !== 0 && <line x1="20" y1="20" x2="0" y2="20" stroke="#4a3119" strokeWidth="6" />}
                <circle cx="20" cy="20" r="5" fill={isA || isB ? "#4e7d3a" : "#4a3119"} />
                {isA && <text x="20" y="24" textAnchor="middle" fontSize="10" fill="#fbf7ec">A</text>}
                {isB && <text x="20" y="24" textAnchor="middle" fontSize="10" fill="#fbf7ec">B</text>}
              </svg>
            </button>
          );
        })}
      </div>
      <div className="mb-3 text-sm text-[#3b2f23]">
        {solved ? "✅ Đường nối liền!" : "Chưa nối tới B…"}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(rots)}
          className={`flex-1 rounded border-2 border-[#4a3119] px-3 py-1.5 text-sm ${
            solved ? "bg-[#4e7d3a] text-[#fbf7ec]" : "bg-[#f3e8cf] text-[#3b2f23]"
          }`}
        >
          Kết nối
        </button>
        <CancelButton onCancel={onCancel} />
      </div>
    </div>
  );
}

export function JigsawRenderer({ perm, onSubmit, onCancel }: RendererProps & { perm: number[] }) {
  const [p, setP] = useState<number[]>(perm);
  const [sel, setSel] = useState<number | null>(null);
  const solved = jigsawSolved(p);
  return (
    <div className="w-72 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
      <h3 className="f-display mb-1 text-sm text-[#4e7d3a]">Mở rương — Ghép hình</h3>
      <p className="mb-3 text-xs text-[#6b5b45]">Click 2 ô để đổi mảnh — xếp mảnh N vào ô N</p>
      <div className="mb-3 grid grid-cols-4 gap-1" data-testid="jigsaw-grid">
        {p.map((piece, i) => {
          const right = piece === i;
          return (
            <button
              key={i}
              onClick={() => {
                if (sel === null) {
                  setSel(i);
                } else if (sel === i) {
                  setSel(null);
                } else {
                  setP((cur) => jigsawSwap(cur, sel, i));
                  setSel(null);
                }
              }}
              className={`h-14 rounded border-2 text-lg font-bold ${
                right
                  ? "border-[#4e7d3a] bg-[#e7f0dd] text-[#4e7d3a]"
                  : sel === i
                    ? "border-[#c0452f] bg-[#f3e8cf] text-[#c0452f]"
                    : "border-[#4a3119] bg-[#f3e8cf] text-[#3b2f23]"
              }`}
            >
              {piece + 1}
            </button>
          );
        })}
      </div>
      <div className="mb-3 text-sm text-[#3b2f23]">
        {solved ? "✅ Hình hoàn chỉnh!" : `Đúng chỗ: ${p.filter((v, i) => v === i).length}/16`}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => (solved ? onSubmit(p) : null)}
          disabled={!solved}
          className="flex-1 rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-3 py-1.5 text-sm text-[#fbf7ec] disabled:opacity-40"
        >
          Hoàn thành
        </button>
        <CancelButton onCancel={onCancel} />
      </div>
    </div>
  );
}

function CancelButton({ onCancel }: { onCancel: () => void }) {
  return (
    <button onClick={onCancel} className="rounded border-2 border-[#c0452f] px-3 py-1.5 text-sm text-[#c0452f]">
      Bỏ qua
    </button>
  );
}
