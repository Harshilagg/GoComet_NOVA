import React, { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

/**
 * QueryPanel — Natural language query interface over trade shipment data.
 *
 * Flow: User types question → POST /query → displays grounded answer + SQL + raw rows.
 * ANTI-HALLUCINATION: Only shows answers backed by actual database rows.
 */

const EXAMPLE_QUERIES = [
  "How many shipments were flagged this week?",
  "Show all pending human reviews",
  "List all shipments for Nike",
  "How many shipments were auto-approved?",
  "Show shipments requiring amendments",
  "What is the average extraction confidence?",
];

export default function QueryPanel({ getToken }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const runQuery = async (q) => {
    const queryText = (q || question).trim();
    if (!queryText) return;
    setLoading(true);
    setResult(null);
    setError("");
    setQuestion(queryText);
    try {
      const res = await axios.post(
        `${API}/query`,
        { question: queryText }
      );
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || "Query failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
          <span className="text-slate-400">💬</span>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Natural Language Query
          </h3>
          <span className="ml-auto text-[10px] text-slate-300 font-medium">
            Groq LLM → SQL → SQLite
          </span>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runQuery()}
              placeholder="Ask about your shipments..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            <button
              onClick={() => runQuery()}
              disabled={loading || !question.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>🔎 Ask</>
              )}
            </button>
          </div>

          {/* Example queries */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_QUERIES.map((q, i) => (
              <button
                key={i}
                onClick={() => runQuery(q)}
                className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1 rounded-lg transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Answer */}
          <div className="px-4 py-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <span className="text-sm">🤖</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Answer ({result.row_count} record{result.row_count !== 1 && "s"} found)
                </p>
                <p className="text-sm text-slate-800 font-medium leading-relaxed">
                  {result.answer || "No answer generated."}
                </p>
              </div>
            </div>
          </div>

          {/* SQL Generated */}
          {result.sql_generated && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Generated SQL
              </p>
              <code className="text-[10px] font-mono text-indigo-600 bg-indigo-50/80 px-2 py-1 rounded-lg block overflow-x-auto whitespace-pre-wrap border border-indigo-100">
                {result.sql_generated}
              </code>
            </div>
          )}

          {/* Raw results toggle */}
          {result.raw_results?.length > 0 && (
            <div className="px-4 py-3">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showRaw ? "▼ Hide" : "▶ Show"} raw results ({result.raw_results.length} rows)
              </button>
              {showRaw && (
                <div className="mt-2 bg-slate-50 rounded-xl border border-slate-100 p-3 overflow-x-auto max-h-48 overflow-y-auto">
                  <pre className="text-[10px] font-mono text-slate-600">
                    {JSON.stringify(result.raw_results, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
