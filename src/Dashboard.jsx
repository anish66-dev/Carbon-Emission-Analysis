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
  const [sortMetric, setSortMetric] = useState('savings'); // 'savings', 'reduction', 'cost'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc', 'desc'

  // User details from localStorage / context
  const userRole = localStorage.getItem('user_role') || 'Staff'; // Admin, Staff, Auditor
  const tenantId = localStorage.getItem('tenant_id');

  const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
  const [isDirDropdownOpen, setIsDirDropdownOpen] = useState(false);
  const metricLabels = {
    savings: 'Monthly Savings',
    reduction: 'Carbon Reduction',
    cost: 'Upfront Cost'
  };
  const dirLabels = {
    asc: 'Ascending ↑',
    desc: 'Descending ↓'
  };

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    billing_period: '',
    category: 'Electricity', // Default fallback value
    raw_value: '',
    unit: 'kWh',
    cost: ''
  });

  useEffect(() => {
    if (formData.category === 'Electricity') {
      setFormData(prev => ({ ...prev, unit: 'kWh' }));
    } else if (formData.category === 'Diesel' || formData.category === 'Petrol') {
      setFormData(prev => ({ ...prev, unit: 'Liters' }));
    }
  }, [formData.category]);

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

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
    const dataPayload = new FormData();
    dataPayload.append("file", file);

    try {
      const parseResponse = await axios.post(
        "http://127.0.0.1:8000/api/v1/logs/parse-bill",
        dataPayload,
        { headers: { ...getAuthHeaders().headers, "Content-Type": "multipart/form-data" } }
      );

      if (parseResponse.data.status === "Success") {
        const extracted = parseResponse.data.pre_fill_data;

        // Load AI extracted fields cleanly into local editable fields
        setFormData({
          billing_period: extracted.billing_period || '',
          category: extracted.category || 'Electricity',
          raw_value: extracted.input_data?.raw_value || '',
          unit: extracted.input_data?.unit || 'kWh',
          cost: extracted.input_data?.cost || ''
        });

        setUploadStatus("READY_FOR_UPLOAD");
        setIsFormModalOpen(true); // Fire open the review dashboard form modal node
      }
    } catch (error) {
      console.error("Ingestion crash:", error);
      setUploadStatus("PROCESSING_FAILED");
      setTimeout(() => setUploadStatus("READY_FOR_UPLOAD"), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setUploadStatus("COMMITTING_TO_LEDGER...");

    const newLogInput = {
      billing_period: formData.billing_period,
      category: formData.category,
      user_input_value: parseFloat(formData.raw_value),
      unit: formData.unit,
      applied_coefficient: formData.category === "Electricity" ? "Regional Grid Coeff" : "Fuel Coeff Standard",
      regulatory_source_citation: "Awaiting Live Ledger Sync Refresh Authority"
    };

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/v1/logs", {
        tenant_id: tenantId,
        facility_id: "FAC-HQ-01",
        billing_period: formData.billing_period,
        scope: formData.category === "Electricity" ? 2 : 1,
        category: formData.category,
        input_data: {
          raw_value: newLogInput.user_input_value,
          unit: formData.unit,
          cost: parseFloat(formData.cost)
        }
      }, getAuthHeaders());

      const backendCalculatedTons = res.data.co2e_metric_tons;
      newLogInput.calculated_output_tons = backendCalculatedTons;

      // 1. OPTIMISTIC STATE UPDATE A: Push to master logs state and enforce chronological order
      setLogs(prevLogs => {
        const updatedLogs = [newLogInput, ...prevLogs];
        // Keep master data array explicitly sorted from oldest date to newest date
        return updatedLogs.sort((a, b) => a.billing_period.localeCompare(b.billing_period));
      });

      // 2. OPTIMISTIC STATE UPDATE B: Update Recharts timeline graph state
      setDashboardData(prevData => {
        let updatedChartData;
        const scopeKey = formData.category === "Electricity" ? "scope_2" : "scope_1";
        const nodeExists = prevData.chart_data.some(item => item.month === newLogInput.billing_period);

        if (nodeExists) {
          updatedChartData = prevData.chart_data.map(item => {
            if (item.month === newLogInput.billing_period) {
              return {
                ...item,
                [scopeKey]: parseFloat((item[scopeKey] + backendCalculatedTons).toFixed(4))
              };
            }
            return item;
          });
        } else {
          updatedChartData = [
            ...prevData.chart_data,
            {
              month: newLogInput.billing_period,
              scope_1: scopeKey === "scope_1" ? backendCalculatedTons : 0,
              scope_2: scopeKey === "scope_2" ? backendCalculatedTons : 0
            }
          ];
          updatedChartData.sort((a, b) => a.month.localeCompare(b.month));
        }

        const updatedLifetimeTons = parseFloat((prevData.intensity_metrics.total_lifetime_emissions_tons + backendCalculatedTons).toFixed(4));

        return {
          ...prevData,
          intensity_metrics: {
            ...prevData.intensity_metrics,
            total_lifetime_emissions_tons: updatedLifetimeTons
          },
          chart_data: updatedChartData
        };
      });

      setIsFormModalOpen(false);
      setFormData({ billing_period: '', category: 'Electricity', raw_value: '', unit: 'kWh', cost: '' });
      setAutoScrollLogs(true);

    } catch (err) {
      console.error("Ledger write failure:", err);
      alert(err.response?.data?.detail || "Failed to commit log metrics data.");
    } finally {
      setUploadStatus("READY_FOR_UPLOAD");
    }
  };

  // AI generation
  const handleGenerateRecommendations = async () => {
    setIsGeneratingAI(true);
    try {
      await axios.post(`http://127.0.0.1:8000/api/v1/advisor/recommendations/generate?tenant_id=${tenantId}`, {}, getAuthHeaders());
      const aiRes = await axios.get(`http://127.0.0.1:8000/api/v1/advisor/recommendations?tenant_id=${tenantId}`, getAuthHeaders());
      setRecommendations(aiRes.data.recommendations || []);
    } catch (err) {
      // Captures the precise string message sent up from your backend error exceptions
      const errMsg = err.response?.data?.detail || "Neural Engine failure.";
      alert(errMsg);
    } finally {
      setIsGeneratingAI(false);
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
    } catch (error) {
      console.error("Failed to update task on server:", error);
      alert("System sync dropped. Reverting card status.");
    }
    const aiRes = await axios.get(`http://127.0.0.1:8000/api/v1/advisor/recommendations?tenant_id=${tenantId}`, getAuthHeaders());
    setRecommendations(aiRes.data.recommendations || []);
  };

  // Delete Log Action (Staff & Admin Only)
  const handleDeleteLog = async (logItem) => {
  if (userRole === 'Auditor') return;
  
  const confirmDelete = window.confirm(
    `CRITICAL WARNING: Are you sure you want to purge this record from active analytics?\nPeriod: ${logItem.billing_period} | Yield: ${logItem.calculated_output_tons} Tons`
  );
  if (!confirmDelete) return;

  const substractedTons = logItem.calculated_output_tons || 0;
  const targetPeriod = logItem.billing_period;
  const targetScopeKey = logItem.category === "Electricity" ? "scope_2" : "scope_1";

  // 1. OPTIMISTIC UPDATE: Evict locally instantly for peak performance responsiveness
  setLogs(prevLogs => prevLogs.filter(item => item !== logItem));

  setDashboardData(prevData => {
    const updatedChartData = prevData.chart_data.map(node => {
      if (node.month === targetPeriod) {
        return {
          ...node,
          [targetScopeKey]: Math.max(0, parseFloat((node[targetScopeKey] - substractedTons).toFixed(4)))
        };
      }
      return node;
    }).filter(node => (node.scope_1 + node.scope_2) > 0);

    const updatedLifetimeTons = Math.max(0, parseFloat((prevData.intensity_metrics.total_lifetime_emissions_tons - substractedTons).toFixed(4)));

    return {
      ...prevData,
      intensity_metrics: {
        ...prevData.intensity_metrics,
        total_lifetime_emissions_tons: updatedLifetimeTons
      },
      chart_data: updatedChartData
    };
  });

  // 2. FIXED: UNCOMMENTED & ACTIVATED BACKGROUND RETRIEVAL DB SYNC HOOK
  try {
    await axios.delete(
      `http://127.0.0.1:8000/api/v1/logs?tenant_id=${tenantId}&billing_period=${logItem.billing_period}&category=${logItem.category}&calculated_output_tons=${logItem.calculated_output_tons}`, 
      getAuthHeaders()
    );
    console.log("Database core cluster synced completely.");
  } catch (error) {
    console.error("Backend eviction drop crash, running complete rollback recovery loop:", error);
    alert("Database sync failed. Reverting data array to baseline.");
    // Rollback recovery step: pull fresh data if server communication breaks down
    fetchAllData();
  }
};

  const [userList, setUserList] = useState([]);
  const [activeStatusDropdown, setActiveStatusDropdown] = useState(null); // Tracks open dropdown row index

  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/v1/admin/users", getAuthHeaders());
      setUserList(res.data || []);
    } catch (err) {
      console.error("Failed to read user directories:", err.message);
    }
  };

  // Fire this fetch automatically when the user clicks onto the admin panel
  useEffect(() => {
    if (activeTab === 'admin' && userRole === 'Admin') {
      fetchUsers();
    }
  }, [activeTab]);

  // Admin Account Creation Setup
  const handleCreateAccount = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/api/v1/admin/users",
        {
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role
        },
        getAuthHeaders()
      );

      alert(res.data.message || "Account provisioned successfully.");

      // Reset state parameters clean
      setNewUser({ name: '', email: '', password: '', role: 'Staff' });

      // Re-trigger the directory list sync to immediately show the new user row
      fetchUsers();

    } catch (err) {
      const errorFeedback = err.response?.data?.detail || "Identity routing processing failure.";
      alert(errorFeedback);
    }
  };

  const handleDeleteUser = async (userEmail) => {
    const confirmUserWipe = window.confirm(`CRITICAL SYSTEM ACTION: Are you sure you want to permanently delete user [ ${userEmail} ]?\nThis action cannot be undone.`);
    if (!confirmUserWipe) return;

    try {
      const res = await axios.delete(`http://127.0.0.1:8000/api/v1/admin/users/${userEmail}`, getAuthHeaders());
      alert(res.data.message || "User successfully evicted from active directory.");

      // Refresh the user roster grid immediately to mirror deletion changes
      fetchUsers();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Eviction routine failed.";
      alert(errorMsg);
    }
  };

  const handleToggleUserStatus = async (userEmail, currentStatus) => {
    const nextStatus = !currentStatus;

    // Optimistic local UI State transition
    setUserList(prev => prev.map(u => u.email === userEmail ? { ...u, is_active: nextStatus } : u));
    setActiveStatusDropdown(null);

    try {
      await axios.patch(`http://127.0.0.1:8000/api/v1/admin/users/${userEmail}/status`, { is_active: nextStatus }, getAuthHeaders());
    } catch (err) {
      alert("Failed to modify target security baseline status node.");
      fetchUsers(); // Rollback to actual server data on error
    }
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
      <main className="relative z-10 px-8 pt-0 max-w-[1600px] mx-auto pb-32">

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
              {/* Document Dropzone - Smart Ingestion Component */}
              {userRole !== 'Auditor' && (
                <div className="md:col-span-5 bg-slate-900/60 border border-white/10 rounded-xl p-6 h-[340px] flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xs font-mono text-slate-400 uppercase mb-1">Smart Document Ingestion</h3>
                      <p className="text-xs text-slate-400">Upload utility invoices or fuel records directly to parse fields dynamically.</p>
                    </div>

                    {/* ADDED: High-visibility Yellow manual logging route navigation macro button */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ billing_period: '', category: 'Electricity', raw_value: '', unit: 'kWh', cost: '' }); // Clear any stale pre-fills
                        setIsFormModalOpen(true);
                      }}
                      className="bg-[#ffb35d] hover:bg-[#e09b4c] text-slate-950 font-mono font-bold text-[10px] px-2.5 py-1 rounded transition-colors uppercase shrink-0 tracking-wider shadow-md"
                    >
                      Enter Manually
                    </button>
                  </div>

                  <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files[0])} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
                  <div onClick={() => fileInputRef.current?.click()} className={`flex-grow border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all bg-white/[0.02] mt-3 ${isUploading ? 'border-emerald-400 bg-emerald-400/5 animate-pulse' : 'border-white/10 hover:border-emerald-500/40'}`}>
                    <span className="material-symbols-outlined text-3xl text-slate-500 mb-2">upload_file</span>
                    <span className="font-mono text-xs text-white">{uploadStatus}</span>
                  </div>
                </div>
              )}

              {/* Real-time System Feed Matrix */}
              <div className="md:col-span-7 bg-slate-900/60 border border-white/10 rounded-xl p-6 h-[340px] flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                  <h3 className="text-xs font-mono text-slate-400 uppercase">Live Telemetry Ledger Trail</h3>
                  <span className="text-[10px] font-mono text-emerald-400">[ RUNNING_FEED ]</span>
                </div>
                <div className="flex-grow overflow-y-auto space-y-3 font-mono text-xs">
                  {logs.length === 0 ? (
                    <span className="text-slate-500">No transactions caught in registry loop.</span>
                  ) : (
                    // FIXED: Changed slice boundary from 10 to 5 to strictly display the 5 latest records
                    logs.slice(-5).reverse().map((log, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded p-2 hover:bg-white/[0.04] animate-fadeIn">
                        <div className="flex gap-4">
                          <span className="text-slate-500">{log.billing_period}</span>
                          <span className="text-white">{log.category} ➔ {log.user_input_value} {log.unit}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">+{log.calculated_output_tons?.toFixed(2)} T</span>
                        </div>
                      </div>
                    ))
                  )}
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
        {activeTab === 'matrix' && userRole !== 'Auditor' && (
          <div className="space-y-6">
            {/* UPDATED HEADER: Changed gap-4 to gap-2, and reduced pb-4 to pb-2 to pull everything closer */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 py-3">

              {/* Left text cluster stays aligned */}
              <div>
                <h2 className="text-xl text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400">auto_awesome</span> Neural Advisory Strategy Hub
                </h2>
                <p className="text-xs text-slate-400">Tailored mitigation workflows automatically compiled by the GROQ Engine ecosystem.</p>
              </div>

              {/* CONTROL MATRIX ROW (Now perfectly centered vertically with the title text) */}
              <div className="flex items-center gap-3 relative font-mono text-xs">

                {/* 1. CUSTOM METRIC DROPDOWN BUTTON */}
                <div className="relative w-52">
                  <button
                    type="button"
                    onClick={() => { setIsMetricDropdownOpen(!isMetricDropdownOpen); setIsDirDropdownOpen(false); }}
                    className="bg-slate-900 border border-white/10 hover:border-purple-500/40 text-slate-200 px-4 py-2 rounded font-bold transition-all flex items-center justify-between shadow-lg w-full"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-slate-500 text-[10px]">SORT:</span>
                      <span className="truncate">{metricLabels[sortMetric]}</span>
                    </div>
                    <span className="material-symbols-outlined text-xs text-slate-500 transition-transform duration-200 shrink-0" style={{ transform: isMetricDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                  </button>

                  {isMetricDropdownOpen && (
                    <div className="absolute inset-x-0 mt-1 bg-slate-900 border border-white/10 rounded shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-fadeIn">
                      <button type="button" onClick={() => { setSortMetric('savings'); setIsMetricDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-purple-500/10 hover:text-purple-400 transition-colors ${sortMetric === 'savings' ? 'text-purple-400 bg-purple-500/5 font-bold' : 'text-slate-300'}`}>Monthly Savings</button>
                      <button type="button" onClick={() => { setSortMetric('reduction'); setIsMetricDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-purple-500/10 hover:text-purple-400 transition-colors ${sortMetric === 'reduction' ? 'text-purple-400 bg-purple-500/5 font-bold' : 'text-slate-300'}`}>Carbon Reduction</button>
                      <button type="button" onClick={() => { setSortMetric('cost'); setIsMetricDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-purple-500/10 hover:text-purple-400 transition-colors ${sortMetric === 'cost' ? 'text-purple-400 bg-purple-500/5 font-bold' : 'text-slate-300'}`}>Upfront Cost</button>
                    </div>
                  )}
                </div>

                {/* 2. CUSTOM DIRECTION DROPDOWN BUTTON */}
                <div className="relative w-42">
                  <button
                    type="button"
                    onClick={() => { setIsDirDropdownOpen(!isDirDropdownOpen); setIsMetricDropdownOpen(false); }}
                    className="bg-slate-900 border border-white/10 hover:border-purple-500/40 text-slate-200 px-4 py-2 rounded font-bold transition-all flex items-center justify-between shadow-lg w-full"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]">WAY:</span>
                      <span>{dirLabels[sortDirection]}</span>
                    </div>
                    <span className="material-symbols-outlined text-xs text-slate-500 transition-transform duration-200 shrink-0" style={{ transform: isDirDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                  </button>

                  {isDirDropdownOpen && (
                    <div className="absolute inset-x-0 mt-1 bg-slate-900 border border-white/10 rounded shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-fadeIn">
                      <button type="button" onClick={() => { setSortDirection('desc'); setIsDirDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-purple-500/10 hover:text-purple-400 transition-colors ${sortDirection === 'desc' ? 'text-purple-400 bg-purple-500/5 font-bold' : 'text-slate-300'}`}>Descending ↓</button>
                      <button type="button" onClick={() => { setSortDirection('asc'); setIsDirDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-purple-500/10 hover:text-purple-400 transition-colors ${sortDirection === 'asc' ? 'text-purple-400 bg-purple-500/5 font-bold' : 'text-slate-300'}`}>Ascending ↑</button>
                    </div>
                  )}
                </div>

                {/* 3. GENERATION ACTION BUTTON */}
                <button
                  type="button"
                  onClick={handleGenerateRecommendations}
                  disabled={isGeneratingAI}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-950/50 text-white font-bold px-4 py-2 rounded shadow-md transition-all flex items-center gap-2 whitespace-nowrap h-[34px]"
                >
                  <span className="material-symbols-outlined text-sm animate-spin" style={{ display: isGeneratingAI ? 'inline-block' : 'none' }}>sync</span>
                  {isGeneratingAI ? "COMPILING STRATEGY..." : "GENERATE RECOMMENDATIONS"}
                </button>

              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendations.length > 0 ? (
                recommendations
                  .sort((a, b) => {
                    // Map keys back accurately to dataset item attributes
                    let valA = sortMetric === 'savings' ? a.estimated_monthly_savings
                      : sortMetric === 'reduction' ? a.estimated_carbon_reduction_pct
                        : a.estimated_upfront_cost;

                    let valB = sortMetric === 'savings' ? b.estimated_monthly_savings
                      : sortMetric === 'reduction' ? b.estimated_carbon_reduction_pct
                        : b.estimated_upfront_cost;

                    // Fallback default zeroes for clean missing value evaluation loops
                    valA = valA || 0;
                    valB = valB || 0;

                    // Return sorting order weight based on active direction toggle selection
                    return sortDirection === 'desc' ? valB - valA : valA - valB;
                  })
                  .map((rec) => (
                    <div key={rec.task_key} className="bg-slate-900 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-all flex flex-col justify-between min-h-[340px] group">
                      <div className="flex flex-col flex-grow justify-between mb-4">

                        {/* Top Text Cluster (Category, Title, Description) */}
                        <div className="mb-4">
                          <div className="flex justify-between items-start mb-4">
                            <span className="font-mono text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">[{rec.category}]</span>
                            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${rec.status === 'In-Progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                              {rec.status}
                            </span>
                          </div>

                          <h4 className="text-md text-white font-bold mb-2 group-hover:text-purple-400 transition-colors">{rec.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">{rec.description}</p>
                        </div>

                        {/* Value Indicators Metric Matrix (Now perfectly anchored at the bottom of the content area) */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-lg border border-white/5 font-mono text-[11px]">
                          <div className="text-center">
                            <span className="block text-[9px] text-slate-500 uppercase">Savings</span>
                            <span className="text-emerald-400 font-bold">₹{rec.estimated_monthly_savings}/mo</span>
                          </div>
                          <div className="text-center border-x border-white/10">
                            <span className="block text-[9px] text-slate-500 uppercase">Reduction</span>
                            <span className="text-cyan-400 font-bold">-{rec.estimated_carbon_reduction_pct}%</span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[9px] text-slate-500 uppercase">Capex Cost</span>
                            <span className="text-amber-400 font-bold">₹{rec.estimated_upfront_cost || "0"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Footer Buttons (Stays at the very bottom edge of the card) */}
                      <div className="flex gap-2 border-t border-white/5 pt-4">
                        {rec.status !== 'In-Progress' && (
                          <button onClick={() => handleUpdateTaskStatus(rec.task_key, "In-Progress")} className="flex-1 py-1 text-xs font-mono border border-amber-400/40 text-amber-400 hover:bg-amber-400/5 rounded transition-all">Start</button>
                        )}
                        <button onClick={() => handleUpdateTaskStatus(rec.task_key, "Completed")} className="flex-1 py-1 text-xs font-mono border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/5 rounded transition-all">Complete</button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="col-span-3 text-center py-12 bg-slate-900/20 border border-white/10 rounded-xl font-mono text-xs text-slate-500">
                  Click 'Generate Recommendations' above to query the optimization model.
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
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400 text-white"
                />
                <input
                  type="email" placeholder="Email Identification Anchor" required
                  value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400 text-white"
                />
                <input
                  type="password" placeholder="System Encryption Secure Key Token" required
                  value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400 text-white"
                />
                <select
                  value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-red-400 text-slate-300"
                >
                  <option value="Staff">Staff Operator Scope</option>
                  <option value="Auditor">Official Regulatory Auditor</option>
                  <option value="Admin">Full Executive Root Administrator</option>
                </select>
                <button type="submit" className="md:col-span-2 mt-2 bg-red-500 hover:bg-red-600 text-slate-950 font-bold font-mono text-xs py-2 rounded transition-colors">
                  PROVISION SECURITY CHANNEL
                </button>
              </form>
            </div>
            {/* USER ACCESS DIRECTORY LEDGER ROSTER */}
            <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden mt-6 font-mono text-xs">
              <div className="p-4 bg-white/[0.02] border-b border-white/5 text-slate-300 font-bold uppercase tracking-wider">
                Active Organization Identity Channels
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-white/10 text-slate-400 text-[11px]">
                      <th className="p-4">Operator Name</th>
                      <th className="p-4">Email Anchor</th>
                      <th className="p-4">System Scope Role</th>
                      <th className="p-4 text-center w-40">System Status</th>
                      <th className="p-4 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {userList.map((user, idx) => (
                      <tr key={user.email} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4 font-bold text-white">{user.name}</td>
                        <td className="p-4 text-slate-400">{user.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${user.role === 'Admin' ? 'bg-red-500/10 text-red-400' : user.role === 'Auditor' ? 'bg-sky-500/10 text-sky-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4 text-center relative overflow-visible">

                          {/* CUSTOM STATUS MATCHED DROPDOWN BUTTON */}
                          <button
                            type="button"
                            onClick={() => setActiveStatusDropdown(activeStatusDropdown === idx ? null : idx)}
                            className={`px-3 py-1 rounded font-bold text-[11px] transition-all flex items-center justify-between gap-2 mx-auto w-28 border ${user.is_active !== false ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                          >
                            <span>{user.is_active !== false ? 'Active' : 'Inactive'}</span>
                            <span className="material-symbols-outlined text-[12px]">expand_more</span>
                          </button>

                          {/* DROPDOWN OVERLAY CONTEXT MENU */}
                          {activeStatusDropdown === idx && (
                            <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-28 bg-slate-950 border border-white/10 rounded shadow-2xl z-50 overflow-hidden text-left backdrop-blur-xl animate-fadeIn">
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(user.email, false)} // set to active (current status false -> sets to true)
                                className={`w-full px-3 py-2 hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-300 border-b border-white/5 ${user.is_active !== false ? 'text-emerald-400 font-bold bg-emerald-500/5' : ''}`}
                              >
                                Active
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(user.email, true)} // set to inactive
                                className={`w-full px-3 py-2 hover:bg-red-500/10 hover:text-red-400 text-slate-300 ${user.is_active === false ? 'text-red-400 font-bold bg-red-500/5' : ''}`}
                              >
                                Inactive
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.email)}
                            className="text-slate-500 hover:text-red-400 transition-colors duration-150 p-1 rounded hover:bg-red-500/5 flex items-center justify-center mx-auto"
                            title="Purge User Channel"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      {/* DYNAMIC MODAL INGESTION EDIT & VALIDATION FORM EDGE */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-xl shadow-2xl p-6 animate-fadeIn">

            <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-base">fact_check</span>
                {formData.raw_value ? "Verify Extracted Data Metrics" : "Manual Carbon Ledger Logging"}
              </h3>
              <button type="button" onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-red-400 transition-colors">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">

              {/* Category selector option drops */}
              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1.5">Resource Stream Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                >
                  <option value="Electricity">Electricity (Scope 2)</option>
                  <option value="Diesel">Diesel Fuel Consumption (Scope 1)</option>
                  <option value="Petrol">Petrol/Gasoline Combustion (Scope 1)</option>
                </select>
              </div>

              {/* Billing period field layout block */}
              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1.5">Target Billing Period (YYYY-MM)</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-05"
                  pattern="^\d{4}-(0[1-9]|1[0-2])$"
                  title="Format must match YYYY-MM explicitly"
                  value={formData.billing_period}
                  onChange={e => setFormData({ ...formData, billing_period: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                  required
                />
              </div>

              {/* Consumption quantities block splits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1.5">Quantity ({formData.unit})</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Total usage volume"
                    value={formData.raw_value}
                    onChange={e => setFormData({ ...formData, raw_value: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1.5">Financial Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Total invoice charge"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-emerald-500 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Modal footer interactive action buttons */}
              <div className="flex gap-2 pt-2 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded transition-colors text-xs"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition-colors text-xs"
                >
                  COMMIT TO LEDGER
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}