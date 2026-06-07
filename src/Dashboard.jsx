import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function ExecutiveDashboard({ sessionCtx, onLogout }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const logFeedRef = useRef(null);

  // --- 1. DYNAMIC STATE MANAGEMENT ---
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("READY_FOR_UPLOAD");

  const [dashboardData, setDashboardData] = useState({
    company_name: "Loading...",
    sustainability_grade: "-",
    intensity_metrics: { emissions_per_employee_tons: 0 },
    chart_data: []
  });

  const [logs, setLogs] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  
  // New States for Log Interactions
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);

  // Setup Axios Authorization Header
  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` }
  });

  const tenantId = localStorage.getItem('tenant_id');

  // --- 2. MASTER DATA INITIALIZATION ---
  const fetchAllData = async () => {
    if (!tenantId) return;
    const headers = getAuthHeaders();
    setIsLoading(true);
    try {
      const dashRes = await axios.get(`http://127.0.0.1:8000/api/v1/analytics/dashboard?tenant_id=${tenantId}`, headers);
      setDashboardData(dashRes.data);

      try {
        const auditRes = await axios.get(`http://127.0.0.1:8000/api/v1/audit/ledger?tenant_id=${tenantId}`, headers);
        const formattedLogs = dashRes.data.chart_data.length === 0 ? [] : auditRes.data.audit_ledger.map((log, i) => ({
          id: i,
          time: "VERIFIED",
          text: `Log: ${log.category} | ${log.user_input_value} ${log.unit} | Yield: ${log.calculated_output_tons.toFixed(2)} Tons`,
          highlight: i === 0
        })).reverse();
        setLogs(formattedLogs);
      } catch (auditErr) {
        console.error("Ledger route failed or empty:", auditErr.message);
      }

    } catch (dashErr) {
      console.error("Critical Dashboard Core Failure:", dashErr.message);
    }
    
    // UPDATED: Fixed AI Endpoint to /api/v1/advisor/recommendations
    try {
      const aiRes = await axios.get(`http://127.0.0.1:8000/api/v1/advisor/recommendations?tenant_id=${tenantId}`, headers);
      setRecommendations(aiRes.data.recommendations || []);
    } catch (aiErr) {
      console.error("AI Recommendations 404 Error:", aiErr.message);
      setRecommendations([]); 
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // UPDATED: Auto-scrolling telemetry loop with stop conditions
  useEffect(() => {
    const feed = logFeedRef.current;
    if (!feed || !autoScrollLogs) return;
    
    const scrollInterval = setInterval(() => {
      // Check if we haven't reached the bottom
      if (feed.scrollTop + feed.clientHeight < feed.scrollHeight) {
        feed.scrollTop += 1;
      } else {
        // Stop scrolling entirely upon hitting the bottom
        setAutoScrollLogs(false);
        clearInterval(scrollInterval);
      }
    }, 50);
    
    return () => clearInterval(scrollInterval);
  }, [logs, autoScrollLogs]);

  // --- 3. SMART VISION UPLOAD & INGESTION ---
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
          `[AI EXTRACTION COMPLETE]\n\nCategory: ${extracted.category}\nAmount: ${extracted.input_data.raw_value} ${extracted.input_data.unit}\nPeriod: ${extracted.billing_period}\n\nCommit this data to the immutable ledger?`
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
          setAutoScrollLogs(true); // Restart scroll for new data
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

  // --- 4. AI TASK STATE CONTROLLER ---
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

  const executeTerminalShutdown = () => {
    onLogout();
    navigate('/');
  };

  if (isLoading) {
    return <div className="h-screen w-screen bg-slate-950 text-primary flex items-center justify-center font-data-lg">INITIALIZING TELEMETRY...</div>;
  }

  return (
    <div className="bg-surface text-on-surface selection:bg-primary/30 min-h-screen relative overflow-x-hidden">
      {/* Background Matrix Mesh Pattern */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <svg height="100%" width="100%">
          <defs><pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"></path></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)"></rect>
        </svg>
      </div>
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[80vw] h-[614px] pointer-events-none blur-[120px] bg-gradient-to-b from-amber-400/20 to-transparent z-0"></div>

      <header className="relative z-10 px-margin-edge pt-12 pb-8 flex justify-between items-end max-w-[1600px] mx-auto">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <span className="font-label-caps text-label-caps text-primary tracking-[0.3em] uppercase">Executive Terminal</span>
            <span className="h-[1px] w-12 bg-primary/30"></span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-white font-extrabold tracking-tight">{dashboardData.company_name}</h1>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-3 bg-surface-container/40 border border-white/10 px-4 py-2 rounded-lg backdrop-blur-md">
            <div className="flex flex-col text-right">
              <span className="font-label-caps text-[10px] text-on-surface-variant">SUSTAINABILITY RATING</span>
              <span className="font-data-md text-data-md text-white">[ {dashboardData.badge_title || "OPERATIONAL"} ]</span>
            </div>
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-[0_0_15px_rgba(255,191,0,0.1)] animate-[pulse_2s_infinite] ${dashboardData.sustainability_grade.includes('A') ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400' : 'border-amber-400/50 bg-amber-400/10 text-amber-400'}`}>
              <span className="font-headline-lg text-2xl font-bold">{dashboardData.sustainability_grade}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-margin-edge grid grid-cols-1 md:grid-cols-12 gap-bento-gap max-w-[1600px] mx-auto pb-32">
        
        {/* 1. Primary Recharts Telemetry Area Card */}
        <div className="md:col-span-8 glass-card rounded-xl p-6 h-[420px] flex flex-col">
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">monitoring</span>
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase">Scope 1 &amp; 2 Emission Telemetry (Tons)</h3>
            </div>
          </div>
          <div className="flex-grow w-full h-full min-h-[220px]">
            {dashboardData.chart_data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.chart_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScope1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#5af0b3" stopOpacity={0.2} /><stop offset="95%" stopColor="#5af0b3" stopOpacity={0} /></linearGradient>
                    <linearGradient id="colorScope2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#5de6ff" stopOpacity={0.2} /><stop offset="95%" stopColor="#5de6ff" stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#bbcac0', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: '#bbcac0', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#191f31', borderColor: 'rgba(255,255,255,0.1)', color: '#dce1fb', fontFamily: 'JetBrains Mono' }} />
                  <Area type="monotone" dataKey="scope_1" stroke="#5af0b3" strokeWidth={2} fillOpacity={1} fill="url(#colorScope1)" />
                  <Area type="monotone" dataKey="scope_2" stroke="#5de6ff" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorScope2)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-on-surface-variant font-data-md">No chart telemetry available. Upload data.</div>
            )}
          </div>
        </div>

        {/* 2. Intensity Radial Progress Card */}
        <div className="md:col-span-4 glass-card rounded-xl p-6 h-[420px] flex flex-col items-center justify-center text-center">
          <div className="w-full flex justify-start mb-auto">
            <span className="material-symbols-outlined text-primary text-sm mr-2">speed</span>
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase">Intensity Index</h3>
          </div>
          <div className="relative w-48 h-48 mt-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-white/5" cx="96" cy="96" r="88" fill="transparent" stroke="currentColor" strokeWidth="8"></circle>
              <circle className="text-primary drop-shadow-[0_0_8px_rgba(90,240,179,0.5)]" cx="96" cy="96" r="88" fill="transparent" stroke="currentColor" strokeWidth="12" strokeDasharray="552.92" strokeDashoffset={552.92 - (552.92 * Math.min(dashboardData.intensity_metrics.emissions_per_employee_tons, 1))} strokeLinecap="round"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline-lg text-4xl text-white font-bold">{dashboardData.intensity_metrics.emissions_per_employee_tons.toFixed(3)}</span>
              <span className="font-label-caps text-[10px] text-on-surface-variant">TONS / EMP</span>
            </div>
          </div>
        </div>

        {/* 3. Document Ingestion Terminal */}
        <div className="md:col-span-5 glass-card rounded-xl h-[380px] p-8 flex flex-col relative">
          <div className="scanline"></div>
          <div className="mb-6">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Ingestion Terminal</h3>
            <p className="font-body-md text-sm text-on-surface-variant">Drop billing invoices, fuel slips, or system receipts for vision matrix processing.</p>
          </div>
          <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files[0])} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
          <div onClick={() => fileInputRef.current?.click()} className={`flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center group cursor-pointer transition-all bg-white/5 ${isUploading ? 'border-primary animate-pulse' : 'border-white/10 hover:border-primary/40'}`}>
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-4xl text-primary/40 group-hover:text-primary">upload_file</span>
            </div>
            <span className="font-data-md text-white text-center px-4">{uploadStatus}</span>
          </div>
        </div>

        {/* 4. Operational Log Feed */}
        <div className="md:col-span-7 glass-card rounded-xl h-[380px] flex flex-col">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">list_alt</span>
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase">Operational Log Feed</h3>
            </div>
            
            {/* UPDATED: Added button to view all logs */}
            <div className="flex items-center gap-4">
              <span className="font-data-md text-[10px] text-primary/60">[ LIVE_STREAM ]</span>
              <button 
                onClick={() => setIsLogModalOpen(true)}
                className="text-[10px] font-label-caps px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white transition-colors"
              >
                VIEW ALL LOGS
              </button>
            </div>
          </div>
          
          {/* UPDATED: User interaction override to cancel auto-scroll */}
          <div 
            ref={logFeedRef} 
            onWheel={() => setAutoScrollLogs(false)}
            onTouchStart={() => setAutoScrollLogs(false)}
            onMouseDown={() => setAutoScrollLogs(false)}
            className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 font-data-md text-sm"
          >
            {logs.length === 0 ? <span className="text-on-surface-variant">No system logs detected.</span> : 
              // UPDATED: Limiting to top 5 recent logs for the main feed view
              logs.slice(0, 10).map((log) => (
              <div key={log.id} className={`flex gap-4 items-start border-l-2 pl-4 py-1 transition-colors duration-500 ${log.highlight ? 'border-primary/80 text-primary' : 'border-white/10 text-white'}`}>
                <span className="text-on-surface-variant shrink-0">{log.time}</span>
                <span>{log.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. AI Strategy & Recommendation Engine */}
        <div className="md:col-span-12 glass-card rounded-xl p-6 min-h-[300px] flex flex-col">
          <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
            <span className="material-symbols-outlined text-secondary text-lg">auto_awesome</span>
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase">AI Strategy &amp; Optimization Matrix</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.length > 0 ? recommendations.map((rec) => (
              <div key={rec.task_key} className="bg-white/5 border border-white/10 rounded-lg p-5 hover:border-secondary/30 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-data-md text-secondary text-xs">[{rec.category}]</span>
                  <span className={`px-2 py-1 text-[10px] font-label-caps rounded ${rec.status === 'Completed' ? 'bg-primary/20 text-primary' : rec.status === 'In-Progress' ? 'bg-amber-400/20 text-amber-400' : 'bg-white/10 text-white'}`}>
                    {rec.status.toUpperCase()}
                  </span>
                </div>
                <h4 className="font-headline-lg text-lg text-white mb-2">{rec.title}</h4>
                <p className="font-body-md text-sm text-on-surface-variant mb-4">{rec.description}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdateTaskStatus(rec.task_key, "In-Progress")} className="flex-1 py-1 text-xs border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 rounded font-data-md">Start</button>
                  <button onClick={() => handleUpdateTaskStatus(rec.task_key, "Completed")} className="flex-1 py-1 text-xs border border-primary/50 text-primary hover:bg-primary/10 rounded font-data-md">Complete</button>
                </div>
              </div>
            )) : (
              <div className="col-span-3 text-center text-on-surface-variant font-data-md py-8">Awaiting sufficient dataset to generate insights...</div>
            )}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 bg-surface-container/60 backdrop-blur-2xl px-3 py-3 rounded-full border border-white/10 shadow-2xl">
          <a className="flex items-center gap-3 bg-primary/20 text-primary px-6 py-2 rounded-full border border-primary/20" href="#">
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="font-label-caps text-[10px] tracking-widest hidden md:inline">OVERVIEW</span>
          </a>
          <a className="p-3 text-on-surface-variant hover:text-white" title="Simulation Engine" href="#"><span className="material-symbols-outlined text-xl">query_stats</span></a>
          <a className="p-3 text-on-surface-variant hover:text-white" title="Carbon Offset Market" href="#"><span className="material-symbols-outlined text-xl">eco</span></a>
          <a className="p-3 text-on-surface-variant hover:text-white" title="Auditor Ledger" href="#"><span className="material-symbols-outlined text-xl">security</span></a>
          <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
          <a className="p-3 text-on-surface-variant hover:text-white" title="Facility Settings" href="#"><span className="material-symbols-outlined text-xl">settings</span></a>
          <button onClick={executeTerminalShutdown} className="p-3 text-error/60 hover:text-error transition-all" title="Terminate Session"><span className="material-symbols-outlined text-xl">power_settings_new</span></button>
        </div>
      </nav>

      {/* UPDATED: Modal view for Full Logs Hierarchy */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="glass-card rounded-xl border border-white/10 w-full max-w-3xl h-[70vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-xl">
              <h2 className="font-headline-lg text-xl text-white">Complete Immutable Ledger</h2>
              <button onClick={() => setIsLogModalOpen(false)} className="text-on-surface-variant hover:text-error transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 font-data-md text-sm bg-surface">
              {logs.length === 0 ? (
                <span className="text-on-surface-variant">No system logs detected.</span>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className={`flex gap-4 items-start border-l-2 pl-4 py-1 ${log.highlight ? 'border-primary/80 text-primary' : 'border-white/10 text-white'}`}>
                    <span className="text-on-surface-variant shrink-0">{log.time}</span>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}