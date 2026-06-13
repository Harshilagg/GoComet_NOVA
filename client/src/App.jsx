import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import PipelineStatus from "./components/PipelineStatus";
import FieldCard from "./components/FieldCard";
import ValidationTable from "./components/ValidationTable";
import RouterDecision from "./components/RouterDecision";
import QueryPanel from "./components/QueryPanel";
import ShipmentList from "./components/ShipmentList";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

// ─── Utility Components ───────────────────────────────────────────────────────

const DECISION_STYLES = {
  auto_approve:       { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  human_review:       { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200" },
  amendment_required: { bg: "bg-red-50",      text: "text-red-600",     border: "border-red-200" },
};

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`rounded-2xl p-4 border ${color.bg} ${color.border} flex items-center gap-3`}>
      <span className="text-xl">{icon}</span>
      <div>
        <p className={`text-2xl font-black ${color.text}`}>{value}</p>
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, sub }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-slate-400 text-sm">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
      {sub && <span className="ml-auto text-[10px] text-slate-300 font-medium">{sub}</span>}
    </div>
  );
}

// Nav tab button
function NavTab({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold w-full transition-all duration-200
        ${active ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * OverallConfidenceGauge — Large circular gauge for the detail panel.
 */
function OverallConfidenceGauge({ confidence, label }) {
  const pct = Math.round((confidence || 0) * 100);
  const size = 80;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 85 ? "#10b981" : pct >= 65 ? "#f59e0b" : "#ef4444";
  const bgColor = pct >= 85 ? "bg-emerald-50" : pct >= 65 ? "bg-amber-50" : "bg-red-50";
  const borderColor = pct >= 85 ? "border-emerald-100" : pct >= 65 ? "border-amber-100" : "border-red-100";

  return (
    <div className={`flex items-center gap-4 rounded-2xl border ${borderColor} ${bgColor} px-5 py-4`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="5" />
          <circle
            cx={size/2} cy={size/2} r={radius}
            fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-lg font-black tabular-nums"
          style={{ color }}
        >
          {pct}%
        </span>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label || "Overall Confidence"}</p>
        <p className="text-[11px] text-slate-500 mt-1">
          {pct >= 85 ? "High confidence — data looks reliable" :
           pct >= 65 ? "Medium confidence — review recommended" :
           "Low confidence — manual verification needed"}
        </p>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  // Navigation
  const [activeView, setActiveView] = useState("dashboard"); // dashboard | shipments | query

  // Upload state
  const [files, setFiles]           = useState([]);
  const [uploading, setUploading]   = useState(false);
  const [drag, setDrag]             = useState(false);
  const [customerId, setCustomerId] = useState("generic");

  // Upload tracking docs (from Node.js in-memory store)
  const [docs, setDocs]             = useState([]);

  // SQLite shipments (actual pipeline results)
  const [shipments, setShipments]   = useState([]);
  const [activeShipId, setActiveSh] = useState(null);
  const [shipDetail, setShipDetail] = useState(null);
  const [loadingDetail, setLoadDet] = useState(false);

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [presignedUrl, setPresigned] = useState(null);
  const [loadingPreview, setLoadPv] = useState(false);

  // Stats
  const [stats, setStats]           = useState({});

  const pollIntervalRef = useRef(null);

  // ── Fetch docs (upload status) ─────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/documents`);
      setDocs(res.data || []);
    } catch (e) {
      // Silently fail
    }
  }, []);

  // ── Fetch shipments from SQLite (via Node proxy) ───────────────────────────
  const fetchShipments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/shipments`);
      setShipments(res.data.shipments || []);
    } catch (e) {
      // Silently fail — AI service may not be up yet
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch (e) {}
  }, []);

  // Poll shipments every 5s to pick up pipeline completions
  useEffect(() => {
    fetchDocs();
    fetchShipments();
    fetchStats();
    pollIntervalRef.current = setInterval(() => {
      fetchDocs();
      fetchShipments();
      fetchStats();
    }, 5000);
    return () => clearInterval(pollIntervalRef.current);
  }, [fetchDocs, fetchShipments, fetchStats]);

  // ── Fetch shipment detail ─────────────────────────────────────────────────
  const openShipment = async (id) => {
    setActiveSh(id);
    setShipDetail(null);
    setLoadDet(true);
    try {
      const res = await axios.get(`${API}/shipments/${id}`);
      setShipDetail(res.data);
    } catch (e) {
      setShipDetail(null);
    } finally {
      setLoadDet(false);
    }
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const upload = useCallback(async () => {
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("document", file);
        fd.append("customerId", customerId);
        const res = await axios.post(`${API}/upload`, fd);

        const doc = res.data.documents?.[0];
        if (doc) {
          axios.post(`${API}/trigger`,
            { docId: doc.id, fileUrl: doc.fileUrl, customerId }
          ).catch(err => console.error("Trigger error:", err));
        }
      }
      setFiles([]);
      fetchDocs();
      // Refresh shipments shortly after trigger
      setTimeout(fetchShipments, 3000);
    } catch (e) {
      console.error("Upload error:", e);
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [files, uploading, customerId, fetchShipments, fetchDocs]);

  // ── Presigned URL preview ─────────────────────────────────────────────────
  const [previewError, setPreviewError] = useState(null);

  const openPreview = async (doc) => {
    setPreviewDoc(doc);
    setLoadPv(true);
    setPresigned(null);
    setPreviewError(null);
    try {
      const res = await axios.get(`${API}/documents/${doc.id}/view`);
      setPresigned(res.data.url);
    } catch (e) {
      console.error(e);
      setPreviewError(e.response?.data?.error || "Failed to load document preview. Did you restart the Node server?");
    } finally {
      setLoadPv(false);
    }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const processingCount = docs.filter(d => d.status === "processing").length;
  const reviewCount  = shipments.filter(s => s.decision === "human_review").length;
  const amendCount   = shipments.filter(s => s.decision === "amendment_required").length;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden font-sans">

      {/* ══════════ LEFT SIDEBAR ══════════ */}
      <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col">

        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-[15px] font-black text-slate-900 tracking-tight leading-none">
                GoComet
              </h1>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Trading operations document processors
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 py-4 space-y-1 border-b border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300 px-2 mb-2">
            Navigation
          </p>
          <NavTab active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} icon="📊" label="Dashboard" />
          <NavTab active={activeView === "shipments"} onClick={() => setActiveView("shipments")} icon="📦" label="Shipments" badge={processingCount} />
          <NavTab active={activeView === "query"}     onClick={() => setActiveView("query")}     icon="💬" label="Query" />
        </div>

        {/* Alerts */}
        {(reviewCount > 0 || amendCount > 0) && (
          <div className="px-3 py-3 border-b border-slate-100 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300 px-2 mb-2">
              Alerts
            </p>
            {reviewCount > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 rounded-lg">
                <span className="text-sm"></span>
                <span className="text-[11px] font-semibold text-amber-700">{reviewCount} pending review{reviewCount > 1 && "s"}</span>
              </div>
            )}
            {amendCount > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-red-50 rounded-lg">
                <span className="text-sm"></span>
                <span className="text-[11px] font-semibold text-red-600">{amendCount} amendment{amendCount > 1 && "s"}</span>
              </div>
            )}
          </div>
        )}

        {/* Stats quick view */}
        <div className="px-3 py-3 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300 px-2 mb-2">
            Quick Stats
          </p>
          {[
            { l: "Total Shipments", v: stats.total_shipments ?? "—", c: "text-slate-700" },
            { l: "Auto Approved",   v: stats.auto_approved ?? "—",   c: "text-emerald-600" },
            { l: "Human Review",    v: stats.human_review ?? "—",    c: "text-amber-600" },
            { l: "Amendments",      v: stats.amendment_required ?? "—", c: "text-red-500" },
          ].map(s => (
            <div key={s.l} className="flex justify-between items-center px-2 py-1.5">
              <span className="text-[11px] text-slate-500">{s.l}</span>
              <span className={`text-xs font-extrabold ${s.c}`}>{s.v}</span>
            </div>
          ))}
        </div>

        {/* System status */}
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium">System Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ══════════ CENTER PANEL ══════════ */}
      <main className="flex-1 min-w-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        <div className="max-w-2xl mx-auto px-6 py-7 space-y-6">

          {/* ─── Dashboard View ─────────────────────────────────────────── */}
          {activeView === "dashboard" && (
            <>
              {/* Page header */}
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Shipment Workflow
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Multi-agent trade document processing — Extractor → Validator → Router
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Approved"  value={stats.auto_approved ?? 0}      icon="" color={{ bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700" }} />
                <StatCard label="Review"    value={stats.human_review ?? 0}       icon="" color={{ bg: "bg-amber-50",   border: "border-amber-100",   text: "text-amber-700" }} />
                <StatCard label="Amendments" value={stats.amendment_required ?? 0} icon="" color={{ bg: "bg-red-50",    border: "border-red-100",    text: "text-red-600" }} />
                <StatCard label="Failed"    value={stats.failed ?? 0}             icon="" color={{ bg: "bg-slate-50",  border: "border-slate-100",  text: "text-slate-600" }} />
              </div>

              {/* Upload Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <SectionHeader icon="" title="Upload Trade Document" />

                  {/* Customer selector */}
                  <div className="flex items-center gap-2 mb-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Customer Rules:
                    </label>
                    <select
                      value={customerId}
                      onChange={e => setCustomerId(e.target.value)}
                      className="flex-1 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-400 transition-all"
                    >
                      <option value="generic">Generic (Any)</option>
                      <option value="nike">Nike Inc.</option>
                      <option value="adidas">Adidas AG</option>
                      <option value="zara">Zara (Inditex)</option>
                      <option value="apple">Apple Inc.</option>
                      <option value="maersk">Maersk Line</option>
                    </select>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) setFiles(Array.from(e.dataTransfer.files)); }}
                    onClick={() => document.getElementById("fi").click()}
                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                      ${drag ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 bg-slate-50/50 hover:border-slate-300"}`}
                  >
                    <input
                      id="fi"
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={e => { if (e.target.files.length) setFiles(Array.from(e.target.files)); }}
                    />
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <span className="text-xl">📄</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Drop trade documents or <span className="text-indigo-600 font-bold">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      PDF, PNG, JPG — Commercial Invoice, Bill of Lading, Packing List
                    </p>
                  </div>

                  {/* Selected files + upload button */}
                  {files.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {files.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                            <span className="text-sm">📎</span>
                            <span className="text-xs font-medium text-slate-700 truncate flex-1">{f.name}</span>
                            <span className="text-[10px] text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFiles([])}
                          className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                        >
                          Clear
                        </button>
                        <button
                          onClick={upload}
                          disabled={uploading}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 transition-all shadow-md shadow-indigo-200/40"
                        >
                          {uploading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Starting Pipeline…
                            </span>
                          ) : `Run Pipeline — ${customerId.charAt(0).toUpperCase() + customerId.slice(1)} Rules`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Processing queue */}
              {processingCount > 0 && (
                <div className="bg-amber-50 rounded-2xl border border-amber-100 px-5 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <p className="text-xs font-bold text-amber-700">
                      {processingCount} document{processingCount > 1 && "s"} being processed by agents…
                    </p>
                  </div>
                  <p className="text-[11px] text-amber-600">
                    The Extractor → Validator → Router pipeline is running. Dashboard auto-refreshes every 5s.
                  </p>
                </div>
              )}

              {/* Recent Shipments (last 5) */}
              {shipments.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <SectionHeader icon="" title="Recent Shipments" sub={`${shipments.length} total`} />
                  </div>
                  <div className="px-4 py-3">
                    <ShipmentList
                      shipments={shipments.slice(0, 5)}
                      activeId={activeShipId}
                      onSelect={(id) => {
                        openShipment(id);
                        setActiveView("shipments");
                      }}
                    />
                  </div>
                  {shipments.length > 5 && (
                    <div className="px-5 py-3 border-t border-slate-100">
                      <button
                        onClick={() => setActiveView("shipments")}
                        className="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                      >
                        View all {shipments.length} shipments →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── Shipments View ──────────────────────────────────────────── */}
          {activeView === "shipments" && (
            <>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Shipments</h2>
                <p className="text-sm text-slate-400 mt-1">All processed trade documents</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <SectionHeader icon="" title="All Shipments" sub={`${shipments.length} records`} />
                </div>
                <div className="px-4 py-3">
                  <ShipmentList
                    shipments={shipments}
                    activeId={activeShipId}
                    onSelect={openShipment}
                  />
                </div>
              </div>

              {/* Upload tracker — shows real-time upload progress */}
              {docs.some(d => d.status === "processing") && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <SectionHeader icon="" title="Upload Tracker" sub="In-memory" />
                  </div>
                  <div className="divide-y divide-slate-50">
                    {docs.filter(d => d.status === "processing").map(d => (
                      <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-slate-300">📎</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{d.fileName}</p>
                          <p className="text-[10px] text-slate-400">
                            {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Processing
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Query View ──────────────────────────────────────────────── */}
          {activeView === "query" && (
            <>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Query</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Ask questions about your shipment data in plain English
                </p>
              </div>
              <QueryPanel />
            </>
          )}
        </div>
      </main>

      {/* ══════════ RIGHT PANEL (Shipment Detail) ══════════ */}
      <aside
        className={`shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden transition-all duration-300
          ${activeShipId ? "w-[480px]" : "w-0"}`}
      >
        {activeShipId && (
          <div className="flex flex-col h-full w-[480px]">

            {/* Panel header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Pipeline Results
                </p>
                {shipDetail && (
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate max-w-[340px]">
                    {shipDetail.file_name}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setActiveSh(null); setShipDetail(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: "thin" }}>

              {loadingDetail ? (
                <div className="flex flex-col items-center py-16 gap-3">
                  <div className="w-8 h-8 border-[3px] border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-400">Loading pipeline results…</p>
                </div>
              ) : !shipDetail ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-400">Result not available yet.</p>
                  <p className="text-xs text-slate-300 mt-1">Pipeline may still be running.</p>
                </div>
              ) : (
                <>
                  {/* Overall Confidence Gauges */}
                  <div className="space-y-3">
                    <OverallConfidenceGauge
                      confidence={shipDetail.extraction_confidence}
                      label="Extraction Confidence"
                    />
                    {shipDetail.decision && (
                      <OverallConfidenceGauge
                        confidence={shipDetail.decision.confidence}
                        label="Decision Confidence"
                      />
                    )}
                  </div>

                  {/* Pipeline stepper */}
                  <PipelineStatus status={shipDetail.status} />

                  {/* Router Decision — shown first for fast context */}
                  {shipDetail.decision && (
                    <div>
                      <SectionHeader icon="" title="Router Decision" />
                      <RouterDecision decision={shipDetail.decision} />
                    </div>
                  )}

                  {/* Extracted Fields */}
                  <div>
                    <SectionHeader
                      icon=""
                      title="Extracted Fields"
                      sub={`${Math.round((shipDetail.extraction_confidence || 0) * 100)}% avg confidence`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {["consignee_name", "hs_code", "port_of_loading", "port_of_discharge",
                        "incoterms", "description_of_goods", "gross_weight", "invoice_number"
                      ].map(field => (
                        <FieldCard
                          key={field}
                          fieldName={field}
                          fieldData={shipDetail[field]}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Validation Results */}
                  {shipDetail.validation && Object.keys(shipDetail.validation).length > 0 && (
                    <div>
                      <SectionHeader icon="" title="Validation Results" sub="Deterministic" />
                      <ValidationTable fieldResults={shipDetail.validation} />
                    </div>
                  )}

                  {/* Audit Trail */}
                  {shipDetail.audit_trail?.length > 0 && (
                    <div>
                      <SectionHeader icon="" title="Audit Trail" sub={`${shipDetail.audit_trail.length} events`} />
                      <div className="space-y-1 max-h-48 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                        {[...shipDetail.audit_trail].reverse().map((log, i) => (
                          <div key={i} className="flex items-start gap-2 py-1">
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5
                              ${log.event === "error" ? "bg-red-50 text-red-500"
                              : log.event === "complete" ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-50 text-slate-400"}`}
                            >
                              {log.agent}
                            </span>
                            <p className="text-[11px] text-slate-600 leading-snug">{log.message}</p>
                            {log.duration_seconds > 0 && (
                              <span className="text-[10px] text-slate-300 shrink-0">{log.duration_seconds}s</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View original */}
                  {shipDetail && shipDetail.file_url && (
                    <button
                      onClick={() => openPreview({ id: activeShipId, fileName: shipDetail.file_name })}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-colors"
                    >
                      <span></span> View Original Document
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ══════════ DOCUMENT PREVIEW MODAL ══════════ */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="relative w-full max-w-5xl h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl"></span>
                <h3 className="font-bold text-slate-800 truncate max-w-md">{previewDoc.fileName}</h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              {loadingPreview ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-400">Generating secure link…</p>
                </div>
              ) : previewError ? (
                <div className="text-center space-y-2 max-w-sm">
                  <span className="text-4xl">⚠️</span>
                  <p className="text-sm font-semibold text-slate-700">{previewError}</p>
                </div>
              ) : presignedUrl ? (
                previewDoc.fileName?.toLowerCase().endsWith(".pdf") ? (
                  <iframe src={presignedUrl} className="w-full h-full rounded-xl border border-slate-200 shadow-xl" title={previewDoc.fileName} />
                ) : (
                  <img src={presignedUrl} alt={previewDoc.fileName} className="max-w-full h-auto rounded-xl shadow-2xl" onContextMenu={e => e.preventDefault()} />
                )
              ) : (
                <p className="text-slate-400 italic">Document unavailable.</p>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Secure Pre-signed S3 View — Expires in 7 Days
              </p>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setPreviewDoc(null)} />
        </div>
      )}
    </div>
  );
}
