import React, { useState } from "react";

/**
 * FieldCard — Displays a single extracted shipment field.
 * Shows: field name, extracted value, confidence bar, and source evidence.
 *
 * Confidence color coding:
 *   >= 0.85 → green  (high)
 *   >= 0.65 → amber  (medium)
 *   <  0.65 → red    (low / uncertain)
 */

const FIELD_LABELS = {
  consignee_name:       { label: "Consignee Name",       icon: "" },
  hs_code:              { label: "HS Code",               icon: "" },
  port_of_loading:      { label: "Port of Loading",       icon: "" },
  port_of_discharge:    { label: "Port of Discharge",     icon: "" },
  incoterms:            { label: "Incoterms",             icon: "" },
  description_of_goods: { label: "Goods Description",    icon: "" },
  gross_weight:         { label: "Gross Weight",          icon: "" },
  invoice_number:       { label: "Invoice Number",        icon: "" },
};

function ConfidenceBar({ confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const color =
    pct >= 85 ? "bg-emerald-500" :
    pct >= 65 ? "bg-amber-400" :
    "bg-red-400";
  const textColor =
    pct >= 85 ? "text-emerald-600" :
    pct >= 65 ? "text-amber-600" :
    "text-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${textColor}`}>
        {pct}%
      </span>
    </div>
  );
}

export default function FieldCard({ fieldName, fieldData }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const meta = FIELD_LABELS[fieldName] || { label: fieldName, icon: "📄" };
  const value = fieldData?.value;
  const confidence = fieldData?.confidence ?? 0;
  const evidence = fieldData?.source_evidence;
  const hasValue = value !== null && value !== undefined;

  return (
    <div className={`rounded-xl border p-3.5 transition-all duration-200
      ${!hasValue
        ? "bg-slate-50 border-slate-100"
        : confidence >= 0.85
        ? "bg-emerald-50/40 border-emerald-100"
        : confidence >= 0.65
        ? "bg-amber-50/40 border-amber-100"
        : "bg-red-50/30 border-red-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{meta.icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {meta.label}
        </span>
        {!hasValue && (
          <span className="ml-auto text-[9px] font-bold text-slate-300 uppercase">
            Not found
          </span>
        )}
      </div>

      {/* Value */}
      <p className={`text-sm font-semibold mb-2 leading-snug
        ${!hasValue ? "text-slate-300 italic" : "text-slate-800"}`}
      >
        {hasValue ? value : "—"}
      </p>

      {/* Confidence bar */}
      {hasValue && <ConfidenceBar confidence={confidence} />}

      {/* Evidence toggle */}
      {hasValue && evidence && (
        <div className="mt-2">
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-[10px] text-indigo-400 hover:text-indigo-600 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>{showEvidence ? "▼" : "▶"}</span>
            Source Evidence
          </button>
          {showEvidence && (
            <div className="mt-1.5 p-2.5 bg-white/80 rounded-lg border border-slate-100">
              <p className="text-[11px] text-slate-600 italic leading-relaxed">
                "{evidence}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
