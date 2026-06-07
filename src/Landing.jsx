import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Reusable animated count manager using browser viewport intersections
const AnimatedCounter = ({ target, className }) => {
    const [count, setCount] = useState(0);
    const counterRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        let current = 0;
                        const duration = 2000;
                        const stepTime = Math.abs(Math.floor(duration / target));

                        const timer = setInterval(() => {
                            current += 1;
                            setCount(current);
                            if (current >= target) {
                                setCount(target);
                                clearInterval(timer);
                            }
                        }, stepTime);
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.5 }
        );

        if (counterRef.current) observer.observe(counterRef.current);
        return () => observer.disconnect();
    }, [target]);

    return <span ref={counterRef} className={className}>{count}</span>;
};

export default function LandingPage() {
    const [time, setTime] = useState('[ 00:00:00 UTC ]');
    const navigate = useNavigate();

    // Real-time UTC System Clock Loop
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const timeString = now.toISOString().split('T')[1].split('.')[0] + ' UTC';
            setTime(`[ ${timeString} ]`);
        };
        const interval = setInterval(updateClock, 1000);
        updateClock();
        return () => clearInterval(interval);
    }, []);

    const handleInitSync = (e) => {
        e.preventDefault();
        alert("System Terminal Sync Request Sent. Initializing Auth Routing context...");
    };

    return (
        <div className="font-body-md text-body-md selection:bg-primary/30">
            {/* Top Navigation Bar */}
            <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-edge py-4 bg-surface/60 backdrop-blur-xl border-b border-white/10">
                <div className="flex items-center gap-8">
                    <span className="font-label-caps text-label-caps tracking-widest text-primary">ECO_SYSTEMS_v4.0</span>
                    <div className="hidden md:flex gap-6">
                        <a href="#" className="text-primary font-bold border-b-2 border-primary pb-1 font-label-caps text-label-caps">Systems</a>
                        <a href="#" className="text-on-surface-variant font-medium hover:text-primary transition-all font-label-caps text-label-caps">Protocols</a>
                        <a href="#" className="text-on-surface-variant font-medium hover:text-primary transition-all font-label-caps text-label-caps">Archive</a>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden lg:block font-data-md text-data-md text-secondary/80">
                        {time}
                    </div>
                    <div className="flex items-center gap-4">
                        {/* 2. UPDATE THE TOP BAR BUTTON CLICK LISTENER */}
                        <button
                            onClick={() => navigate('/login')}
                            className="px-6 py-2 border border-secondary text-secondary font-label-caps text-label-caps hover:bg-secondary/10 transition-all active:scale-95 duration-200"
                        >
                            Access Terminal
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Container Viewport */}
            <main className="pt-32 px-margin-edge max-w-7xl mx-auto">
                {/* Hero Section Blueprint */}
                <section className="grid grid-cols-1 md:grid-cols-12 gap-gutter min-h-[716px] items-center mb-32">
                    {/* Text Operations Field */}
                    <div className="md:col-span-6 flex flex-col gap-8">
                        <div className="inline-flex px-3 py-1 rounded-full bg-primary/5 border border-primary/20 w-fit">
                            <span className="font-label-caps text-[10px] text-primary tracking-widest">[ GLOBAL_EMISSIONS_INDEX: V4.0.2 ]</span>
                        </div>
                        <h1 className="font-headline-xl text-headline-xl text-on-surface leading-none">
                            Decentralized <span className="text-primary">Carbon</span> Governance for the 21st Century.
                        </h1>

                        <div className="grid grid-cols-2 gap-bento-gap">
                            <div className="glass-card p-6 relative overflow-hidden">
                                <div className="scan-line"></div>
                                <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">GLOBAL EMISSIONS</p>
                                <div className="flex items-baseline gap-1">
                                    <AnimatedCounter target={71} className="font-data-lg text-headline-lg text-primary" />
                                    <span className="font-data-lg text-primary">%</span>
                                </div>
                                <p className="font-data-md text-data-md text-on-surface-variant/60 mt-2">Historical baseline</p>
                            </div>
                            <div className="glass-card p-6 relative overflow-hidden">
                                <div className="scan-line"></div>
                                <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">GRID EFFICIENCY LOSS</p>
                                <div className="flex items-baseline gap-1">
                                    <AnimatedCounter target={40} className="font-data-lg text-headline-lg text-secondary" />
                                    <span className="font-data-lg text-secondary">%</span>
                                </div>
                                <p className="font-data-md text-data-md text-on-surface-variant/60 mt-2">Active protocol gap</p>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Core SVG Graph Layout */}
                    <div className="md:col-span-6 flex justify-center items-center relative h-full">
                        <div className="w-full aspect-square max-w-lg glass-card rounded-xl p-8 flex items-center justify-center relative group">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <svg className="w-full h-full text-primary" fill="none" stroke="currentColor" viewBox="0 0 400 400">
                                <defs>
                                    <filter id="glow">
                                        <feGaussianBlur result="coloredBlur" stdDeviation="2"></feGaussianBlur>
                                        <feMerge>
                                            <feMergeNode in="coloredBlur"></feMergeNode>
                                            <feMergeNode in="SourceGraphic"></feMergeNode>
                                        </feMerge>
                                    </filter>
                                </defs>
                                <rect className="stroke-2 glow-pulse" height="50" width="50" x="175" y="175"></rect>
                                <text className="font-label-caps text-[8px] fill-primary" textAnchor="middle" x="200" y="205">AI_CORE</text>
                                <g className="nodes">
                                    <circle className="stroke-1" cx="100" cy="100" r="15"></circle>
                                    <circle className="stroke-1" cx="300" cy="100" r="15"></circle>
                                    <circle className="stroke-1" cx="100" cy="300" r="15"></circle>
                                    <circle className="stroke-1" cx="300" cy="300" r="15"></circle>
                                </g>
                                <path className="stroke-1 opacity-40 animate-pulse" d="M100 115 L175 185"></path>
                                <path className="stroke-1 opacity-40 animate-pulse" d="M300 115 L225 185"></path>
                                <path className="stroke-1 opacity-40 animate-pulse" d="M100 285 L175 215"></path>
                                <path className="stroke-1 opacity-40 animate-pulse" d="M300 285 L225 215"></path>
                                <circle fill="currentColor" r="2">
                                    <animateMotion dur="3s" path="M100 115 L175 185" repeatCount="indefinite"></animateMotion>
                                </circle>
                                <circle fill="currentColor" r="2">
                                    <animateMotion dur="4s" path="M300 115 L225 185" repeatCount="indefinite"></animateMotion>
                                </circle>
                            </svg>
                        </div>
                    </div>
                </section>

                {/* Action Input Terminal Box */}
                <section className="max-w-3xl mx-auto mb-32">
                    <div className="glass-card p-12 text-center border-t-2 border-primary/40 relative group overflow-hidden">
                        <div className="scan-line"></div>
                        <h2 className="font-headline-lg text-headline-lg mb-6">Automated multi-tenant carbon accounting</h2>
                        <p className="font-body-md text-on-surface-variant mb-10 max-w-xl mx-auto">
                            The single source of truth for scope 1, 2, and 3 emissions. Deploy audited monitoring protocols across your entire infrastructure in milliseconds.
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); navigate('/login'); }}>
                            <button type="submit">Initialize Sync</button>
                        </form>
                        <div className="mt-8 flex justify-center gap-8 relative z-20">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="font-label-caps text-[10px] text-emerald-400">[ NODES: ACTIVE ]</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                                <span className="font-label-caps text-[10px] text-secondary">[ LATENCY: 14ms ]</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tactical Bento Cards Segment */}
                <section className="grid grid-cols-1 md:grid-cols-4 gap-bento-gap mb-32">
                    <div className="md:col-span-2 glass-card p-8 h-80 flex flex-col justify-between">
                        <div>
                            <span className="material-symbols-outlined text-primary mb-4">query_stats</span>
                            <h3 className="font-headline-lg text-headline-lg mb-2">Real-time Telemetry</h3>
                            <p className="text-on-surface-variant">Continuous auditing of industrial heat maps and energy consumption cycles with sub-second precision.</p>
                        </div>
                        <div className="h-1 bg-surface-container-highest w-full mt-4">
                            <div className="h-full bg-primary w-2/3"></div>
                        </div>
                    </div>
                    <div className="glass-card p-8 h-80 flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-secondary text-4xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                        <h3 className="font-label-caps text-label-caps mb-2">Immutable Protocol</h3>
                        <p className="text-xs text-on-surface-variant">L2 Blockchain settlement for every verified carbon offset transaction.</p>
                    </div>
                    <div className="glass-card p-8 h-80 flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-primary text-4xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
                        <h3 className="font-label-caps text-label-caps mb-2">Biosphere Sync</h3>
                        <p className="text-xs text-on-surface-variant">Direct integration with satellite vegetation indices for accurate sequestration data.</p>
                    </div>
                </section>
            </main>

            {/* Corporate Compliance Footer */}
            <footer className="border-t border-white/5 py-12 px-margin-edge bg-surface-container-lowest/50">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col gap-2">
                        <span className="font-label-caps text-label-caps text-primary">ECO_SYSTEMS_v4.0</span>
                        <span className="font-data-md text-[10px] text-on-surface-variant/40">© 2026 DECENTRALIZED ENVIRONMENTAL GOVERNANCE</span>
                    </div>
                    <div className="flex gap-8">
                        <a href="#" className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-colors">PRIVACY_POLICY</a>
                        <a href="#" className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-colors">TERMS_OF_SERVICE</a>
                        <a href="#" className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-colors">SYSTEM_STATUS</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="font-data-md text-data-md text-secondary/50">[ ENCRYPTED_ENDPOINT: HKG-7 ]</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}