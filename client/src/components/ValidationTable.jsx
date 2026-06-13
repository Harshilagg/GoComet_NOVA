import React from "react";

/**
 * ValidationTable — Displays field-by-field validation results from the Validator Agent.
 *
 * Shows for each field:
 *   - Field name
 *   - Status badge (match / mismatch / uncertain)
 *   - Expected value (from customer rules)
 *   - Found value (from extractor)
 *   - Confidence
 *   - Reason
 */

const FIELD_LABELS = {
  consignee_name:       "Consignee Name",
  hs_code:              "HS Code",
  port_of_loading:      "Port of Loading",
  port_of_discharge:    "Port of Discharge",
  incoterms:            "Incoterms",
  description_of_goods: "Goods Description",
  gross_weight:         "Gross Weight",
  invoice_number:       "Invoice Number",
};

function StatusBadge({ status }) {
  const config = {
    match:     { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500", label: "Match" },
    mismatch:  { bg: "bg-red-50",      text: "text-red-600",     dot: "bg-red-500",     label: "Mismatch" },
    uncertain: { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500",   label: "Uncertain" },
  }[status] || { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-400", label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export default function ValidationTable({ fieldResults }) {
  if (!fieldResults || Object.keys(fieldResults).length === 0) return null;

  const entries = Object.entries(fieldResults);
  const matchCount    = entries.filter(([, v]) => v.status === "match").length;
  const mismatchCount = entries.filter(([, v]) => v.status === "mismatch").length;
  const uncertainCount = entries.filter(([, v]) => v.status === "uncertain").length;

  return (
    <div>
      {/* Summary pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
          ✓ {matchCount} match{matchCount !== 1 && "es"}
        </span>
        {mismatchCount > 0 && (
          <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
            ✗ {mismatchCount} mismatch{mismatchCount !== 1 && "es"}
          </span>
        )}
        {uncertainCount > 0 && (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
            ? {uncertainCount} uncertain
          </span>
        )}
      </div>

      {/* Field-by-field table */}
      <div className="space-y-2">
        {entries.map(([fieldName, result]) => (
          <div
            key={fieldName}
            className={`rounded-xl border p-3 transition-all
              ${result.status === "mismatch"  ? "bg-red-50/60 border-red-100"
              : result.status === "uncertain" ? "bg-amber-50/50 border-amber-100"
              : "bg-slate-50/60 border-slate-100"
            }`}
          >
            {/* Row header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-600">
                {FIELD_LABELS[fieldName] || fieldName}
              </span>
              <div className="flex items-center gap-2">
                <StatusBadge status={result.status} />
              </div>
            </div>

            {/* Expected vs Found (for mismatch/uncertain) */}
            {result.status !== "match" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Expected</p>
                  <p className="text-[11px] font-semibold text-slate-600">
                    {result.expected || <span className="text-slate-300 italic">No rule</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Found</p>
                  <p className={`text-[11px] font-semibold ${result.status === "mismatch" ? "text-red-600" : "text-amber-600"}`}>
                    {result.found ?? <span className="italic">Not extracted</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Reason */}
            {result.reason && (
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                {result.reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
