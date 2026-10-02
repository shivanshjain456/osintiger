"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Geopoint } from "@/lib/osint/types";
import { MapPin, Navigation } from "lucide-react";

// Equirectangular projection: lon -180..180 -> x 0..W, lat 90..-90 -> y 0..H
const W = 1000;
const H = 500;
function project(lon: number, lat: number) {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return { x, y };
}

// Simplified continent silhouettes (low-poly, recognizable). lon/lat polygon coords.
const CONTINENTS: { name: string; pts: [number, number][] }[] = [
  // North America (rough)
  { name: "NA", pts: [[-168,66],[-140,72],[-95,80],[-65,82],[-55,60],[-60,46],[-78,42],[-82,25],[-97,18],[-105,23],[-117,32],[-125,40],[-130,55],[-150,60],[-168,66]] },
  // South America
  { name: "SA", pts: [[-80,12],[-70,12],[-60,8],[-50,5],[-35,-5],[-38,-23],[-58,-35],[-70,-55],[-75,-52],[-80,-30],[-82,-10],[-80,12]] },
  // Europe
  { name: "EU", pts: [[-9,36],[2,43],[12,45],[20,40],[28,41],[40,42],[45,52],[40,65],[28,70],[12,68],[4,62],[-8,58],[-10,50],[-9,36]] },
  // Africa
  { name: "AF", pts: [[-17,15],[0,12],[10,4],[20,2],[35,12],[42,12],[51,12],[50,-2],[42,-15],[35,-22],[20,-35],[15,-34],[8,-5],[-5,5],[-17,15]] },
  // Asia
  { name: "AS", pts: [[40,42],[55,40],[65,35],[78,30],[88,22],[95,18],[105,12],[110,2],[125,-3],[130,-8],[140,0],[145,15],[150,25],[155,45],[145,60],[135,72],[100,75],[70,72],[55,65],[45,52],[40,42]] },
  // Oceania
  { name: "OC", pts: [[112,-12],[125,-12],[140,-12],[152,-22],[150,-38],[138,-36],[120,-34],[113,-22],[112,-12]] },
];

function polygonToPath(pts: [number, number][]): string {
  return pts
    .map(([lon, lat], i) => {
      const { x, y } = project(lon, lat);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

export function IntelMap({ points }: { points: Geopoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  // Assign marker positions. If a point lacks lat/lon, place it on its country centroid (rough).
  const countryCentroid: Record<string, [number, number]> = {
    US: [-98, 39], GB: [-1.5, 53], RU: [60, 60], CN: [104, 35], DE: [10, 51],
    FR: [2.3, 47], IN: [78, 22], JP: [138, 36], BR: [-52, -10], IR: [53, 32],
    IL: [35, 31], UA: [31, 49], KP: [127, 40], SA: [45, 24], AE: [54, 24],
    TR: [35, 39], CA: [-106, 56], AU: [134, -25], SG: [103.8, 1.3], HK: [114.2, 22.3],
    NL: [5.7, 52], CH: [8.2, 46.8], IT: [12.5, 41.9], ES: [-3.7, 40.4], PL: [19.1, 52.0],
    ME: [19.4, 42.7], RS: [21, 44], TW: [121, 23.7], KR: [127.8, 36],
  };

  const positioned = points.map((p) => {
    let lon = p.lon;
    let lat = p.lat;
    if ((lat == null || lon == null) && p.country && countryCentroid[p.country]) {
      lon = countryCentroid[p.country][0];
      lat = countryCentroid[p.country][1];
    }
    return { ...p, lon: lon ?? 0, lat: lat ?? 0 };
  });

  return (
    <div className="relative overflow-hidden  border border-white/10 bg-black/40 osint-grid">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Quantum Intel geospatial map">
        <defs>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00ff41" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00ff41" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="continentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Ocean background */}
        <rect x="0" y="0" width={W} height={H} fill="rgba(15,23,42,0.5)" />

        {/* Graticule */}
        {Array.from({ length: 12 }).map((_, i) => {
          const lon = -180 + i * 30;
          const { x } = project(lon, 0);
          return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />;
        })}
        {Array.from({ length: 7 }).map((_, i) => {
          const lat = 90 - i * 30;
          const { y } = project(0, lat);
          return <line key={`h${i}`} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />;
        })}
        {/* Equator */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(245,158,11,0.18)" strokeWidth={0.8} strokeDasharray="4 4" />

        {/* Continents */}
        {CONTINENTS.map((c) => (
          <path
            key={c.name}
            d={polygonToPath(c.pts)}
            fill="url(#continentFill)"
            stroke="rgba(245,158,11,0.35)"
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
        ))}

        {/* Markers */}
        {positioned.map((p, i) => {
          const { x, y } = project(p.lon, p.lat);
          const isHover = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
              <circle cx={x} cy={y} r={isHover ? 18 : 12} fill="url(#markerGlow)" />
              <circle cx={x} cy={y} r={isHover ? 5 : 3.5} fill="#00ff41" stroke="#fff" strokeWidth={0.8}>
                <animate attributeName="r" values="3.5;6;3.5" dur="1.8s" repeatCount="indefinite" />
              </circle>
              {isHover && (
                <g>
                  <line x1={x} y1={y} x2={x} y2={y - 22} stroke="#00ff41" strokeWidth={0.8} />
                  <circle cx={x} cy={y - 24} r={2} fill="#00ff41" />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hover !== null && positioned[hover] && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2  border border-[var(--hack-green)]/40 bg-black/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div className="font-semibold text-[var(--hack-green)]">{positioned[hover].label}</div>
          {positioned[hover].country && <div className="text-muted-foreground">Country: {positioned[hover].country}</div>}
          {positioned[hover].note && <div className="mt-1 max-w-[260px] text-[11px]">{positioned[hover].note}</div>}
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            src: {positioned[hover].source}
          </div>
        </div>
      )}

      {/* Legend / empty state */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-[10px] text-muted-foreground">
        <MapPin className="h-3 w-3 text-[var(--hack-green)]" />
        <span>{positioned.length} geo signals</span>
        <Navigation className="h-3 w-3 text-[var(--hack-green)]/60 ml-2" />
        <span>Equirectangular</span>
      </div>

      {positioned.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No geographic intelligence available for this target.
        </div>
      )}
    </div>
  );
}
