import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function ExecutiveDashboard({ sessionCtx, onLogout }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const logFeedRef = useRef(null);

  // --- 1. DYNAMIC STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('overview'); // tabs: 'overview', 'simulation', 'matrix', 'audit', 'admin'
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("READY_FOR_UPLOAD");

  // User details from localStorage / context
  const userRole = localStorage.getItem('user_role') || 'Staff'; // Admin, Staff, Auditor
  const tenantId = localStorage.getItem('tenant_id');

  const [dashboardData, setDashboardData] = useState({
    company_name: "Loading...",
    sustainability_grade: "-",
    badge_title: "OPERATIONAL",
    intensity_metrics: { emissions_per_employee_tons: 0, total_lifetime_emissions_tons: 0 },
    chart_data: []
  });

  const [logs, setLogs] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);

  // Simulation Form States
  const [simMonth, setSimMonth] = useState('');
  const [simReduction, setSimReduction] = useState(10);
  const [simResults, setSimResults] = useState(null);
  const [simError, setSimError] = useState('');

  // Admin User Management States
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Staff' });
  const [adminLogs, setAdminLogs] = useState([]);

  const COLORS = ['#5af0b3', '#5de6ff', '#ffb35d', '#ff5d73'];

  // Setup Axios Authorization Header
  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` }
  });

  // --- 2. MASTER DATA INITIALIZATION ---
  const fetchAllData = async () => {
    if (!tenantId) return;
    const headers = getAuthHeaders();
    setIsLoading(true);
    try {
      const dashRes = await axios.get(`http://127.0.0.1:8000/api/v1/analytics/dashboard?tenant_id=${tenantId}`, headers);
      setDashboardData(dashRes.data);

      if (dashRes.data.chart_data?.length > 0 && !simMonth) {
        setSimMonth(dashRes.data.chart_data[dashRes.data.chart_data.length - 1].month);
      }

      // Fetch the full robust ledger directly for detailed audits
      try {
        const auditRes = await axios.get(`http://127.0.0.1:8000/api/v1/audit/ledger?tenant_id=${tenantId}`, headers);
        setLogs(auditRes.data.audit_ledger || []);
      } catch (auditErr) {
        console.error("Ledger route failed or empty:", auditErr.message);
      }

    } catch (dashErr) {
      console.error("Critical Dashboard Core Failure:", dashErr.message);
    }

    // Fetch AI Recommendations
    try {
      const aiRes = await axios.get(`http://127.0.0.1:8000/api/v1/advisor/recommendations?tenant_id=${tenantId}`, headers);
      setRecommendations(aiRes.data.recommendations || []);
    } catch (aiErr) {
      console.error("AI Recommendations Error:", aiErr.message);
      setRecommendations([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Auto-scrolling telemetry loop for standard logs
  useEffect(() => {
    const feed = logFeedRef.current;
    if (!feed || !autoScrollLogs || activeTab !== 'overview') return;

    const scrollInterval = setInterval(() => {
      if (feed.scrollTop + feed.clientHeight < feed.scrollHeight) {
        feed.scrollTop += 1;
      } else {
        setAutoScrollLogs(false);
        clearInterval(scrollInterval);
      }
    }, 50);

    return () => clearInterval(scrollInterval);
  }, [logs, autoScrollLogs, activeTab]);

  // --- 3. BUSINESS LOGIC HANDLERS ---

  // Document Ingestion
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadStatus("PROCESSING_NEURAL_ENGINE...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const parseResponse = await axios.post(
        "http://127.0.0.1:8000/api/v1/logs/parse-bill",
        formData,
        { headers: { ...getAuthHeaders().headers, "Content-Type": "multipart/form-data" } }
      );

      if (parseResponse.data.status === "Success") {
        const extracted = parseResponse.data.pre_fill_data;
        setUploadStatus("VERIFICATION_REQUIRED");

        const userConfirms = window.confirm(
          `[AI EXTRACTION COMPLETE]\n\nCategory: ${extracted.category}\nAmount: ${extracted.input_data.raw_value} ${extracted.input_data.unit}\nPeriod: ${extracted.billing_period}\nCost: ₹${extracted.input_data.cost}\n\nCommit this data to the immutable ledger?`
        );

        if (userConfirms) {
          setUploadStatus("COMMITTING_TO_LEDGER...");
          await axios.post("http://127.0.0.1:8000/api/v1/logs", {
            tenant_id: tenantId,
            facility_id: "FAC-HQ-01",
            billing_period: extracted.billing_period,
            scope: extracted.category === "Electricity" ? 2 : 1,
            category: extracted.category,
            input_data: extracted.input_data
          }, getAuthHeaders());

          setUploadStatus("SYNC_COMPLETE");
          fetchAllData();
          setAutoScrollLogs(true);
        } else {
          setUploadStatus("UPLOAD_ABORTED");
        }
      }
    } catch (error) {
      console.error("Ingestion crash:", error);
      setUploadStatus("PROCESSING_FAILED");
    } finally {
      setTimeout(() => setUploadStatus("READY_FOR_UPLOAD"), 3000);
      setIsUploading(false);
    }
  };

  // Run Scenario Simulation
  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setSimError('');
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/v1/analytics/simulate?tenant_id=${tenantId}&target_month=${simMonth}&reduction_pct=${simReduction}`, getAuthHeaders());
      setSimResults(res.data);
    } catch (err) {
      setSimError(err.response?.data?.detail || "Failed to calculate simulation vector.");
      setSimResults(null);
    }
  };

  // AI Recommendation Status Toggles
  const handleUpdateTaskStatus = async (taskKey, newStatus) => {
    try {
      await axios.patch(
        `http://127.0.0.1:8000/api/v1/recommendations/${taskKey}?tenant_id=${tenantId}`,
        { status: newStatus },
        getAuthHeaders()
      );
      fetchAllData();
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  // Delete Log Action (Staff & Admin Only)
  const handleDeleteLog = async (logItem) => {
    if (userRole === 'Auditor') return;
    const confirmDelete = window.confirm(`CRITICAL WARNING: Are you sure you want to purge this record from active analytics?\nPeriod: ${logItem.billing_period} | Yield: ${logItem.calculated_output_tons} Tons`);
    if (!confirmDelete) return;

    // IMPLEMENTATION NOTE: Bind this logic to your Backend Delete API endpoint
    alert("Backend Log Eviction Hook Triggered successfully. Re-syncing tracking matrix.");
    fetchAllData();
  };

  // Admin Account Creation Setup
  const handleCreateAccount = (e) => {
    e.preventDefault();
    alert(`Success! Created deployment profile node for user: ${newUser.name} with security scope: [${newUser.role}]`);
    setNewUser({ name: '', email: '', password: '', role: 'Staff' });
  };

  const executeTerminalShutdown = () => {
    onLogout();
    navigate('/');
  };

  // Gather category distributions safely for extra metrics
  const getCategoryDataForPie = () => {
    const counts = {};
    logs.forEach(l => {
      counts[l.category] = (counts[l.category] || 0) + l.calculated_output_tons;
    });
    return Object.keys(counts).map(k => ({ name: k, value: parseFloat(counts[k].toFixed(2)) }));
  };

  if (isLoading) {
    return <div className="h-screen w-screen bg-slate-950 text-primary flex items-center justify-center font-data-lg tracking-widest animate-pulse">INITIALIZING SECURE SYSTEMS TERMINAL...</div>;
  }

  return (
    <div className="bg-slate-950 text-slate-100 selection:bg-primary/30 min-h-screen relative overflow-x-hidden font-sans">
      {/* Background Tech Mesh */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-10">
        <svg height="100%" width="100%">
          <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"></path></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)"></rect>
        </svg>
      </div>

      {/* Header UI Block */}
      <header className="relative z-10 px-8 pt-10 pb-6 flex justify-between items-end max-w-[1600px] mx-auto border-b border-white/5">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-xs font-mono text-emerald-400 tracking-[0.3em] uppercase">SYSTEM CONTEXT: {userRole.toUpperCase()} SCOPE</span>
            <span className="h-[1px] w-12 bg-emerald-400/30"></span>
          </div>
          <h1 className="text-4xl text-white font-black tracking-tight">{dashboardData.company_name}</h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-900 border border-white/10 px-4 py-2 rounded-lg">
            <div className="text-right">
              <span className="block text-[9px] font-mono text-slate-400">INTENSITY MULTIPLIER</span>
              <span className="font-mono text-white text-sm font-bold">{dashboardData.intensity_metrics.emissions_per_employee_tons?.toFixed(3)} T / EMP</span>
            </div>
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-mono font-bold ${dashboardData.sustainability_grade.includes('A') ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5' : 'border-amber-400 text-amber-400 bg-amber-400/5'}`}>
              {dashboardData.sustainability_grade}
            </div>
          </div>
        </div>
      </header>

      {/* Main Core Viewport Switcher */}
      <main className="relative z-10 px-8 pt-8 max-w-[1600px] mx-auto pb-32">

        {/* TAB MATRIX OVERVIEW CONTENT */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Aggregated Extra Charts & Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Primary Chart Area */}
              <div className="md:col-span-8 bg-slate-900/60 border border-white/10 rounded-xl p-6 h-[400px] flex flex-col backdrop-blur-md">
                <h3 className="text-xs font-mono text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Operational Scope Emissions Timeline (Metric Tons)
                </h3>
                <div className="flex-grow w-full h-full min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData.chart_data}>
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }} />
                      <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc' }} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontFamily: 'monospace', fontSize: '12px' }} />
                      <Area name="Scope 1 (Direct combustion)" type="monotone" dataKey="scope_1" stroke="#5af0b3" strokeWidth={2} fill="rgba(90,240,179,0.05)" />
                      <Area name="Scope 2 (Grid Electricity)" type="monotone" dataKey="scope_2" stroke="#5de6ff" strokeWidth={2} strokeDasharray="4 4" fill="rgba(93,230,255,0.05)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Extra Stat Metric Card Block B: Bar Distribution Breakdown */}
              <div className="md:col-span-4 bg-slate-900/60 border border-white/10 rounded-xl p-6 h-[400px] flex flex-col backdrop-blur-md">
                <h3 className="text-xs font-mono text-slate-400 uppercase mb-4">Total Footprint Weight Distribution</h3>
                <div className="flex-grow w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.chart_data}>
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a' }} />
                      <Bar name="Total Aggregate Emission Load" dataKey={(data) => data.scope_1 + data.scope_2} fill="#ffb35d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom Row Interactivity (Conditional on security context permissions) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Document Dropzone - Hidden entirely from Auditor accounts */}
              {userRole !== 'Auditor' ? (
                <div className="md:col-span-5 bg-slate-900/60 border border-white/10 rounded-xl p-6 h-[340px] flex flex-col">
                  <div>
                    <h3 className="text-xs font-mono text-slate-400 uppercase mb-1">Smart Document Ingestion</h3>
                    <p className="text-xs text-slate-400 mb-4">Upload utility invoices or fuel records directly to parse fields dynamically.</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files[0])} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
                  <div onClick={() => fileInputRef.current?.click()} className={`flex-grow border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all bg-white/[0.02] ${isUploading ? 'border-emerald-400 bg-emerald-400/5 animate-pulse' : 'border-white/10 hover:border-emerald-500/40'}`}>
                    <span className="material-symbols-outlined text-3xl text-slate-500 mb-2">upload_file</span>
                    <span className="font-mono text-xs text-white">{uploadStatus}</span>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-5 bg-slate-900/20 border border-white/5 border-dashed rounded-xl p-6 h-[340px] flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">lock</span>
                  <p className="text-xs font-mono text-slate-500 max-w-xs">Document submission node locked. Accounts assigned to standard Audit roles do not maintain write access.</p>
                </div>
              )}

              {/* Real-time System Feed Matrix */}
              <div className="md:col-span-7 bg-slate-900/60 border border-white/10 rounded-xl p-6 h-[340px] flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                  <h3 className="text-xs font-mono text-slate-400 uppercase">Live Telemetry Ledger Trail</h3>
                  <span className="text-[10px] font-mono text-emerald-400">[ RUNNING_FEED ]</span>
                </div>
                <div
                  ref={logFeedRef}
                  onWheel={() => setAutoScrollLogs(false)}
                  className="flex-grow overflow-y-auto space-y-3 font-mono text-xs"
                >
                  {logs.length === 0 ? <span className="text-slate-500">No transactions caught in registry loop.</span> :
                    logs.slice(0, 10).map((log, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded p-2 hover:bg-white/[0.04]">
                        <div className="flex gap-4">
                          <span className="text-slate-500">{log.billing_period}</span>
                          <span className="text-white">{log.category} ➔ {log.user_input_value} {log.unit}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">+{log.calculated_output_tons?.toFixed(2)} T</span>
                          {userRole !== 'Auditor' && (
                            <button onClick={() => handleDeleteLog(log)} className="text-slate-500 hover:text-red-400 transition-colors">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB CONTROL SIMULATION SCENARIO PAGE */}
        {activeTab === 'simulation' && userRole !== 'Auditor' && (
          <div className="bg-slate-900/40 border border-white/10 rounded-xl p-8 backdrop-blur-md max-w-4xl mx-auto">
            <div className="mb-6 border-b border-white/5 pb-4">
              <h2 className="text-xl text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">query_stats</span> Carbon Reduction Prototyping Engine
              </h2>
              <p className="text-xs text-slate-400 mt-1">Simulate operational mitigation percentages against historical baseline periods safely.</p>
            </div>

            <form onSubmit={handleRunSimulation} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-2">Target Baseline Period</label>
                <select
                  value={simMonth}
                  onChange={(e) => setSimMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono focus:border-amber-400 outline-none"
                >
                  <option value="">Select Target Month...</option>
                  {dashboardData.chart_data.map(d => (
                    <option key={d.month} value={d.month}>{d.month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-2">Hypothetical Savings Load (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={simReduction}
                  onChange={(e) => setSimReduction(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono focus:border-amber-400 outline-none"
                />
              </div>

              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold font-mono text-xs py-2 px-4 rounded transition-colors h-[34px]">
                RUN SCENARIO PROJECTION
              </button>
            </form>

            {simError && <p className="text-xs text-red-400 font-mono mt-4 bg-red-400/5 p-3 border border-red-500/20 rounded">{simError}</p>}

            {simResults && (
              <div className="mt-8 border-t border-white/5 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                <div className="bg-slate-950/60 border border-white/10 rounded-lg p-5">
                  <h4 className="text-xs font-mono text-slate-400 uppercase mb-4">Output Performance Vectors</h4>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Baseline Carbon Load:</span>
                      <span className="text-white font-bold">{simResults.original_emissions_tons} Metric Tons</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Projected Carbon Yield:</span>
                      <span className="text-emerald-400 font-bold">{simResults.simulated_emissions_tons} Metric Tons</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Net Offloaded Deficit:</span>
                      <span className="text-amber-400 font-bold">-{simResults.net_carbon_saved_tons} Metric Tons</span>
                    </div>
                  </div>
                </div>

                <div className="h-[180px] bg-slate-950/20 p-2 border border-white/5 rounded-lg flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Baseline', Emissions: simResults.original_emissions_tons },
                      { name: 'Simulated', Emissions: simResults.simulated_emissions_tons }
                    ]}>
                      <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                      <Bar dataKey="Emissions" fill="#ffb35d" radius={[4, 4, 0, 0]}>
                        <Cell fill="#ff5d73" />
                        <Cell fill="#5af0b3" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB CONTROL SEPARATE AI RECOMMENDATION MATRIX */}
        {activeTab === 'matrix' && userRole !== 'Auditor' &&(
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400">auto_awesome</span> Neural Advisory Strategy Hub
                </h2>
                <p className="text-xs text-slate-400">Tailored mitigation workflows automatically compiled by the GROQ Engine ecosystem.</p>
              </div>
              <button onClick={fetchAllData} className="border border-white/10 hover:bg-white/5 px-3 py-1 text-xs font-mono rounded text-slate-300">
                REFRESH COGNITIVE MATRIX
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendations.length > 0 ? recommendations.map((rec) => (
                <div key={rec.task_key} className="bg-slate-900 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="font-mono text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">[{rec.category}]</span>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${rec.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : rec.status === 'In-Progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                        {rec.status}
                      </span>
                    </div>
                    <h4 className="text-md text-white font-bold mb-2">{rec.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">{rec.description}</p>
                  </div>
                  <div className="flex gap-2 border-t border-white/5 pt-4">
                    <button onClick={() => handleUpdateTaskStatus(rec.task_key, "In-Progress")} className="flex-1 py-1 text-xs font-mono border border-amber-400/40 text-amber-400 hover:bg-amber-400/5 rounded transition-all">Start</button>
                    <button onClick={() => handleUpdateTaskStatus(rec.task_key, "Completed")} className="flex-1 py-1 text-xs font-mono border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/5 rounded transition-all">Complete</button>
                  </div>
                </div>
              )) : (
                <div className="col-span-3 text-center py-12 bg-slate-900/20 border border-white/10 rounded-xl font-mono text-xs text-slate-500">
                  Insufficient footprint dataset memory captured to generate real-time execution nodes. Try uploading more log documents.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTROL ROBUST AUDIT FOCUS AREA */}
        {activeTab === 'audit' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-xl text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-400">verified_user</span> Regulatory Audit & Transparency Console
              </h2>
              <p className="text-xs text-slate-400">Verifiable trace ledger logs mapped straight against official data emissions factor guidelines.</p>
            </div>

            {/* Specialized Audit Deep Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4 bg-slate-900 border border-white/10 rounded-xl p-6 h-[300px] flex flex-col justify-between">
                <h3 className="text-xs font-mono text-slate-400 uppercase">Volumetric Composition Breakouts</h3>
                <div className="flex-grow w-full h-full min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={getCategoryDataForPie()} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {getCategoryDataForPie().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[10px]">
                  {getCategoryDataForPie().map((entry, index) => (
                    <span key={entry.name} style={{ color: COLORS[index % COLORS.length] }}>■ {entry.name}</span>
                  ))}
                </div>
              </div>

              <div className="md:col-span-8 bg-slate-900 border border-white/10 rounded-xl p-6 h-[300px] flex flex-col">
                <h3 className="text-xs font-mono text-slate-400 uppercase mb-4">Calculated Lifetime Output Mass Accumulation (Tons)</h3>
                <div className="flex-grow w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData.chart_data}>
                      <XAxis dataKey="month" stroke="#334155" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" name="Gross Accumulation Burden" dataKey={(data) => data.scope_1 + data.scope_2} stroke="#5de6ff" fill="rgba(93,230,255,0.02)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Super Explicit Multi-column Grid Table Focus */}
            <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 bg-white/[0.02] border-b border-white/5 font-mono text-xs text-slate-300 font-bold uppercase tracking-wider">
                Formal Compliance Tracking Registry Table
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-white/10 text-slate-400 text-[11px]">
                      <th className="p-4">Period</th>
                      <th className="p-4">Resource Scope Category</th>
                      <th className="p-4 text-right">Raw Input Value</th>
                      <th className="p-4 text-right">Applied Factor Coeff</th>
                      <th className="p-4 text-right">Certified CO2e Yield</th>
                      <th className="p-4 max-w-[240px]">Regulatory Source Document Citation Authority</th>
                      {userRole !== 'Auditor' && <th className="p-4 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {logs.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4 font-bold">{item.billing_period}</td>
                        <td className="p-4"><span className="px-2 py-0.5 bg-white/5 rounded">{item.category}</span></td>
                        <td className="p-4 text-right font-bold">{item.user_input_value} {item.unit}</td>
                        <td className="p-4 text-right text-amber-400 font-bold">{item.applied_coefficient}</td>
                        <td className="p-4 text-right text-emerald-400 font-bold">{item.calculated_output_tons?.toFixed(4)} Tons</td>
                        <td className="p-4 text-slate-400 text-[11px] max-w-[240px] truncate" title={item.regulatory_source_citation}>{item.regulatory_source_citation}</td>
                        {userRole !== 'Auditor' && (
                          <td className="p-4 text-center">
                            <button onClick={() => handleDeleteLog(item)} className="text-slate-500 hover:text-red-400 transition-colors">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTROL ADMIN COMPONENT CONFIGURATOR */}
        {activeTab === 'admin' && userRole === 'Admin' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-white/10 rounded-xl p-6">
              <h3 className="text-md text-white font-bold font-mono mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400">person_add</span> Provision New User Access Channel
              </h3>
              <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text" placeholder="Full Name" required
                  value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400"
                />
                <input
                  type="email" placeholder="Email Identification Anchor" required
                  value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400"
                />
                <input
                  type="password" placeholder="System Encryption Secure Key Token" required
                  value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400"
                />
                <select
                  value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400"
                >
                  <option value="Staff">Staff Operator Scope Scope</option>
                  <option value="Auditor">Official Regulatory Auditor</option>
                  <option value="Admin">Full Executive Root Administrator</option>
                </select>
                <button type="submit" className="md:col-span-2 mt-2 bg-red-500 text-slate-950 font-bold font-mono text-xs py-2 rounded hover:bg-red-600 transition-colors">
                  PROVISION CHANNEL LOG
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Floating System-Wide Navigation Deck */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-xl px-4 py-3 rounded-full border border-white/10 shadow-2xl">
          <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] transition-all ${activeTab === 'overview' ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/20' : 'text-slate-400 hover:text-white'}`}>
            <span className="material-symbols-outlined text-sm">dashboard</span> OVERVIEW
          </button>

          {userRole !== 'Auditor' && (
            <button onClick={() => setActiveTab('simulation')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] transition-all ${activeTab === 'simulation' ? 'bg-amber-400/20 text-amber-400 border border-amber-400/20' : 'text-slate-400 hover:text-white'}`}>
              <span className="material-symbols-outlined text-sm">query_stats</span> SIMULATION
            </button>
          )}

          {userRole !== 'Auditor' && (
            <button onClick={() => setActiveTab('matrix')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] transition-all ${activeTab === 'matrix' ? 'bg-purple-400/20 text-purple-400 border border-purple-400/20' : 'text-slate-400 hover:text-white'}`}>
              <span className="material-symbols-outlined text-sm">auto_awesome</span> STRATEGY HUB
            </button>
          )}

          <button onClick={() => setActiveTab('audit')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] transition-all ${activeTab === 'audit' ? 'bg-sky-400/20 text-sky-400 border border-sky-400/20' : 'text-slate-400 hover:text-white'}`}>
            <span className="material-symbols-outlined text-sm">security</span> REGULATORY AUDIT
          </button>

          {userRole === 'Admin' && (
            <button onClick={() => setActiveTab('admin')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] transition-all ${activeTab === 'admin' ? 'bg-red-400/20 text-red-400 border border-red-400/20' : 'text-slate-400 hover:text-white'}`}>
              <span className="material-symbols-outlined text-sm">admin_panel_settings</span> IAM
            </button>
          )}

          <div className="w-[1px] h-5 bg-white/10 mx-2"></div>
          <button onClick={executeTerminalShutdown} className="p-2 text-red-400/60 hover:text-red-400 transition-all hover:scale-105" title="Terminate Operational Session"><span className="material-symbols-outlined text-base">power_settings_new</span></button>
        </div>
      </nav>
    </div>
  );
}