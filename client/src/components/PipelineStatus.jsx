import React from "react";

/**
 * PipelineStatus — Animated stepper showing live pipeline progress.
 * 
 * Stages: uploading → extracting → validating → routing → completed/failed
 * Each stage shows an icon, label, and duration when complete.
 */

const STAGES = [
  { key: "uploading",  icon: "⬆️",  label: "Uploading",   desc: "Sending to S3" },
  { key: "extracting", icon: "🔍",  label: "Extracting",  desc: "OCR + LLM fields" },
  { key: "validating", icon: "✅",  label: "Validating",  desc: "Rule-based checks" },
  { key: "routing",    icon: "🧭",  label: "Routing",     desc: "Decision engine" },
  { key: "completed",  icon: "🏁",  label: "Completed",   desc: "Result stored" },
];

// Map document status → which stage is active
const STATUS_TO_STAGE = {
  uploaded:             0,
  processing:           1,
  extracted:            2,
  validated:            3,
  auto_approve:         5,
  human_review:         5,
  amendment_required:   5,
  failed:              -1,
};

export default function PipelineStatus({ status, durations = {} }) {
  const currentStageIdx = STATUS_TO_STAGE[status] ?? -1;
  const isFailed = status === "failed";

  if (!status || status === "uploaded") return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-slate-400 text-sm">⚡</span>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Pipeline Status
        </h3>
        {isFailed && (
          <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
            Pipeline Failed
          </span>
        )}
      </div>

      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-slate-100 z-0" />

        <div className="space-y-4 relative z-10">
          {STAGES.map((stage, idx) => {
            const isComplete = currentStageIdx > idx;
            const isActive   = currentStageIdx === idx && !isFailed;
            const isPending  = currentStageIdx < idx;
            const isFailedAt = isFailed && idx === currentStageIdx;

            return (
              <div key={stage.key} className="flex items-center gap-3">
                {/* Step bubble */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base border-2 transition-all duration-500
                    ${isComplete
                      ? "bg-emerald-50 border-emerald-300 shadow-sm"
                      : isActive
                      ? "bg-indigo-50 border-indigo-400 shadow-md shadow-indigo-100 animate-pulse"
                      : isFailedAt
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                    }`}
                >
                  {isComplete
                    ? <span className="text-emerald-500">✓</span>
                    : isActive
                    ? <span className="animate-spin inline-block">⟳</span>
                    : isFailedAt
                    ? <span>❌</span>
                    : <span className="text-slate-400 text-sm">{stage.icon}</span>
                  }
                </div>

                {/* Step label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold
                        ${isComplete  ? "text-emerald-700"
                        : isActive    ? "text-indigo-700"
                        : isFailedAt  ? "text-red-600"
                        : "text-slate-400"
                      }`}
                    >
                      {stage.label}
                    </span>
                    {isComplete && durations[stage.key] && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {durations[stage.key]}s
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[10px] text-indigo-400 font-semibold animate-pulse">
                        Running…
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{stage.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
