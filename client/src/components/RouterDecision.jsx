import React, { useState } from "react";

/**
 * RouterDecision — Displays the Router Agent's decision with reasoning.
 *
 * Shows:
 *   - Decision badge (auto_approve / human_review / amendment_required)
 *   - Confidence score
 *   - Human-readable reasoning from LLM
 *   - Amendment draft (list of corrections if amendment_required)
 *   - Approval summary (if auto_approve)
 */

const DECISION_CONFIG = {
  auto_approve: {
    label:   "Auto Approved",
    icon:    "✅",
    bg:      "bg-emerald-50",
    border:  "border-emerald-200",
    text:    "text-emerald-700",
    badge:   "bg-emerald-100 text-emerald-800",
    accent:  "border-l-emerald-500",
  },
  human_review: {
    label:   "Human Review Required",
    icon:    "👁️",
    bg:      "bg-amber-50",
    border:  "border-amber-200",
    text:    "text-amber-700",
    badge:   "bg-amber-100 text-amber-800",
    accent:  "border-l-amber-500",
  },
  amendment_required: {
    label:   "Amendment Required",
    icon:    "✏️",
    bg:      "bg-red-50",
    border:  "border-red-200",
    text:    "text-red-700",
    badge:   "bg-red-100 text-red-800",
    accent:  "border-l-red-500",
  },
};

function PriorityBadge({ priority }) {
  const cfg = {
    high:   "bg-red-50 text-red-600 border-red-100",
    medium: "bg-amber-50 text-amber-600 border-amber-100",
    low:    "bg-slate-50 text-slate-500 border-slate-100",
  }[priority] || "bg-slate-50 text-slate-500 border-slate-100";

  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg}`}>
      {priority}
    </span>
  );
}

export default function RouterDecision({ decision }) {
  const [showAmendments, setShowAmendments] = useState(true);

  if (!decision) return null;

  const cfg = DECISION_CONFIG[decision.decision] || DECISION_CONFIG.human_review;
  const amendments = decision.amendment_draft || [];
  const confidence = Math.round((decision.confidence || 0) * 100);

  return (
    <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} overflow-hidden`}>
      {/* Decision Header */}
      <div className={`px-4 py-4 border-l-4 ${cfg.accent}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cfg.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-extrabold ${cfg.text}`}>{cfg.label}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {confidence}% confidence
              </span>
            </div>
            {(decision.match_count !== undefined) && (
              <div className="flex gap-3 mt-1.5">
                <span className="text-[10px] text-emerald-600 font-semibold">
                  ✓ {decision.match_count} matched
                </span>
                {decision.mismatch_count > 0 && (
                  <span className="text-[10px] text-red-600 font-semibold">
                    ✗ {decision.mismatch_count} mismatched
                  </span>
                )}
                {decision.uncertain_count > 0 && (
                  <span className="text-[10px] text-amber-600 font-semibold">
                    ? {decision.uncertain_count} uncertain
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Reasoning */}
      {decision.reason && (
        <div className="px-4 py-3 border-t border-white/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            Agent Reasoning
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">
            {decision.reason}
          </p>
        </div>
      )}

      {/* Approval Summary */}
      {decision.decision === "auto_approve" && decision.approval_summary && (
        <div className="px-4 py-3 border-t border-emerald-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1.5">
            Approval Summary
          </p>
          <p className="text-xs text-emerald-700 leading-relaxed">
            {decision.approval_summary}
          </p>
        </div>
      )}

      {/* Amendment Draft */}
      {amendments.length > 0 && (
        <div className="px-4 py-3 border-t border-red-100">
          <button
            onClick={() => setShowAmendments(!showAmendments)}
            className="flex items-center gap-2 w-full"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">
              Amendment Draft ({amendments.length})
            </p>
            <span className="text-[10px] text-red-300 ml-auto">
              {showAmendments ? "▼ Collapse" : "▶ Expand"}
            </span>
          </button>

          {showAmendments && (
            <div className="mt-2 space-y-2">
              {amendments.map((item, i) => (
                <div
                  key={i}
                  className="bg-white/70 rounded-xl border border-red-100 p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold text-red-700 capitalize">
                      {(item.field || "").replace(/_/g, " ")}
                    </span>
                    <PriorityBadge priority={item.priority || "high"} />
                  </div>
                  <p className="text-[10px] text-slate-600 mb-1">
                    <span className="font-semibold">Issue: </span>{item.issue}
                  </p>
                  <p className="text-[10px] text-red-600 font-semibold">
                    → {item.required_correction}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
