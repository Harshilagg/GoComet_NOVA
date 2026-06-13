import React from "react";

/**
 * ShipmentList — List of shipment cards with decision badges.
 * Each card shows: filename, customer, status, decision, confidence ring.
 */

const DECISION_CONFIG = {
  auto_approve:        { label: "Approved",   bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  human_review:        { label: "Review",     bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  amendment_required:  { label: "Amendment",  bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-500" },
};

const STATUS_CONFIG = {
  uploaded:            { bg: "bg-slate-100",  text: "text-slate-500",   label: "Uploaded" },
  processing:          { bg: "bg-blue-50",    text: "text-blue-600",    label: "Processing" },
  extracted:           { bg: "bg-violet-50",  text: "text-violet-600",  label: "Extracted" },
  validated:           { bg: "bg-indigo-50",  text: "text-indigo-600",  label: "Validated" },
  auto_approve:        { bg: "bg-emerald-50", text: "text-emerald-700", label: "Approved" },
  human_review:        { bg: "bg-amber-50",   text: "text-amber-700",   label: "Review" },
  amendment_required:  { bg: "bg-red-50",     text: "text-red-600",     label: "Amendment" },
  failed:              { bg: "bg-red-50",     text: "text-red-500",     label: "Failed" },
};

function DecisionBadge({ decision }) {
  if (!decision) return null;
  const cfg = DECISION_CONFIG[decision] || { label: decision, bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.uploaded;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

/**
 * ConfidenceRing — A small circular progress indicator for confidence scores.
 * Uses SVG to render a ring that fills proportionally to the confidence value.
 */
function ConfidenceRing({ confidence, size = 36 }) {
  if (confidence === undefined || confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 85 ? "#10b981" : pct >= 65 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#f1f5f9" strokeWidth="3"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold tabular-nums"
        style={{ fontSize: size < 36 ? 8 : 9, color }}
      >
        {pct}%
      </span>
    </div>
  );
}

const CUSTOMER_COLORS = {
  nike:    "bg-slate-900 text-white",
  adidas:  "bg-black text-white",
  zara:    "bg-slate-700 text-white",
  apple:   "bg-slate-800 text-white",
  maersk:  "bg-blue-700 text-white",
  generic: "bg-slate-200 text-slate-600",
};

export default function ShipmentList({ shipments = [], activeId, onSelect }) {
  if (shipments.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          <span className="text-2xl opacity-30">📦</span>
        </div>
        <p className="text-sm font-semibold text-slate-400">No shipments processed yet</p>
        <p className="text-xs text-slate-300 mt-1">Upload a trade document above to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shipments.map((s) => {
        // Prefer decision_confidence (from Router Agent) over extraction_confidence
        const displayConfidence = s.decision_confidence ?? s.extraction_confidence;

        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-200 group
              ${activeId === s.id
                ? "bg-indigo-50 border-indigo-300 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
          >
            <div className="flex items-center gap-3">
              {/* Customer tag */}
              <span className={`text-[9px] font-bold px-2 py-1 rounded-lg shrink-0 uppercase tracking-wider ${CUSTOMER_COLORS[s.customer_id] || CUSTOMER_COLORS.generic}`}>
                {s.customer_id || "—"}
              </span>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${activeId === s.id ? "text-indigo-700" : "text-slate-800"}`}>
                  {s.file_name || "Unnamed Document"}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusDot status={s.status} />
                  {s.decision && <DecisionBadge decision={s.decision} />}
                </div>
              </div>

              {/* Confidence ring */}
              {displayConfidence != null && displayConfidence > 0 && (
                <ConfidenceRing confidence={displayConfidence} size={38} />
              )}

              {/* Date */}
              <span className="text-[10px] text-slate-300 shrink-0">
                {s.created_at
                  ? new Date(s.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                  : "—"
                }
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
