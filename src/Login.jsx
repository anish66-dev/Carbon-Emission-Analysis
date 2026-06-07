import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function IdentityAccessGateway({ onLoginSuccess }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Submit Login data array to our FastAPI backend gateway
    const handleFormSubmission = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setErrorMessage("CRITICAL_ERR: Missing login credentials.");
            return;
        }

        setIsAuthenticating(true);
        setErrorMessage('');

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/v1/auth/login', {
                email: email.toLowerCase().trim(),
                password: password
            });

            const { access_token, role, tenant_id } = response.data;

            // Cryptographically commit JWT session tokens to user cache context
            localStorage.setItem('session_token', access_token);
            localStorage.setItem('user_role', role);
            localStorage.setItem('tenant_id', tenant_id);

            // Flash Success state flag to shift parent layout router components
            if (onLoginSuccess) {
                onLoginSuccess({ role, tenant_id });
                navigate('/dashboard');
            }
        } catch (error) {
            console.error("Authentication gateway drop down:", error);
            if (error.response && error.response.status === 401) {
                setErrorMessage("ACCESS_DENIED: Invalid cryptographic credentials.");
            } else {
                setErrorMessage("SYSTEM_ERR: Authentication terminal offline or dropped.");
            }
        } finally {
            setIsAuthenticating(false);
        }
    };

    return (
        <div className="bg-slate-950 text-on-surface font-body-md min-h-screen w-screen flex items-center justify-center overflow-hidden selection:bg-primary/30 relative">

            {/* Ambient Background Shader Grid */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/90 to-primary/5"></div>
                <svg height="100%" width="100%" className="opacity-10">
                    <pattern id="login-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"></path>
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#login-grid)"></rect>
                </svg>
            </div>
            {/* Main Content Blueprint Core Container */}
            <main className="relative z-10 w-full max-w-md px-6 py-12">
                {/* Branding Anchor Header */}
                <div className="mb-12 text-center entrance-stagger">
                    <button onClick={() => navigate('/')} className="font-label-caps text-label-caps tracking-[0.3em] text-primary uppercase mb-2 cursor-pointer group hover:opacity-80 transition-opacity">
                        Back
                    </button>
                    <h1 className="mt-1 font-label-caps text-label-caps tracking-[0.3em] text-primary uppercase mb-2 group hover:opacity-80 transition-opacity">ECO_SYSTEMS_v4.0</h1>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container/50 border border-white/5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="font-data-md text-data-md text-on-surface-variant uppercase tracking-widest">[ GATEWAY: ACTIVE ]</span>
                    </div>
                </div>

                {/* Unified Auth Gateway Card */}
                <div className="glass-card p-8 rounded-xl relative overflow-hidden entrance-stagger delay-1">
                    <div className="scanline-overlay"></div>

                    <div className="mb-8 pb-4 border-b border-white/10">
                        <h2 className="font-headline-lg text-headline-lg text-white mb-1">Identity Access</h2>
                        <p className="font-data-md text-data-md text-on-surface-variant">Initialize biometric or manual credential sync.</p>
                    </div>

                    {/* Dynamic Error Ledger Console Output */}
                    {errorMessage && (
                        <div className="mb-6 p-3 bg-error/10 border border-error text-error text-xs font-data-md rounded">
                            {errorMessage}
                        </div>
                    )}

                    {/* Security Verification Input Forms */}
                    <form onSubmit={handleFormSubmission} className="space-y-6">

                        {/* Email Field Column */}
                        <div className="space-y-2 focus-glow">
                            <label className="font-label-caps text-label-caps text-on-surface-variant block uppercase" htmlFor="email">User_Identifier</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-primary/60 text-lg">alternate_email</span>
                                <input
                                    className="terminal-input w-full pl-8 py-3 text-white font-data-md placeholder:text-slate-700 bg-transparent border-b-2 border-slate-700 focus:outline-none focus:border-primary transition-all"
                                    id="email"
                                    placeholder="Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Password Field Column */}
                        <div className="space-y-2 focus-glow">
                            <label className="font-label-caps text-label-caps text-on-surface-variant block uppercase" htmlFor="password">Security_Protocol</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-primary/60 text-lg">lock_open</span>
                                <input
                                    className="terminal-input w-full pl-8 py-3 text-white font-data-md placeholder:text-slate-700 bg-transparent border-b-2 border-slate-700 focus:outline-none focus:border-primary transition-all"
                                    id="password"
                                    placeholder="••••••••••••"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Ingress Gateway Execution Action Toggles */}
                        <div className="pt-4 flex flex-col gap-4">
                            <button
                                className={`w-full py-4 font-label-caps text-label-caps tracking-widest border border-primary text-primary hover:bg-primary/10 transition-all duration-300 active:scale-95 group relative overflow-hidden ${isAuthenticating ? 'opacity-50 cursor-wait' : ''}`}
                                type="submit"
                                disabled={isAuthenticating}
                            >
                                <span className="relative z-10">{isAuthenticating ? "PROCESSING_HANDSHAKE..." : "INITIALIZE ACCESS"}</span>
                                <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/15 transition-colors"></div>
                            </button>
                            <a className="text-center font-data-md text-data-md text-on-surface-variant hover:text-secondary transition-colors uppercase tracking-tight text-xs" href="#">
                                Trouble accessing terminal?
                            </a>
                        </div>
                    </form>
                </div>

                {/* Footer Ledger Metadata Status */}
                <footer className="mt-8 text-center entrance-stagger delay-3">
                    <p className="font-data-md text-[10px] text-slate-600 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                        SECURE DATA TRANSMISSION ENCRYPTED 256-BIT
                    </p>
                </footer>
            </main>
        </div>
    );
}