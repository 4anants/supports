import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../contexts/ConfigContext';
import { LifeBuoy, ArrowRight, Activity } from 'lucide-react';

const LandingPage = () => {
    const { config, loading } = useConfig();
    const navigate = useNavigate();
    const [clickCount, setClickCount] = useState(0);

    const handleLogoClick = () => {
        setClickCount(prev => prev + 1);
    };

    useEffect(() => {
        if (clickCount >= 5) {
            setClickCount(0);
            navigate('/admin', { state: { fromSecretAction: true } });
        }
    }, [clickCount, navigate]);

    if (loading) return (
        <div className="h-screen bg-[#111827] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] p-4 font-sans text-slate-200">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-[#0f172a] z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-900/20 to-transparent opacity-40"></div>
            </div>

            {/* Main Floating Card - Wider to accommodate split */}
            <div className="relative z-10 flex w-full max-w-7xl h-[650px] bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50">

                {/* Left Panel: Image (BIG - 66%) */}
                <div className="hidden lg:block w-2/3 relative">
                    <div className="absolute inset-0 bg-cyan-900/10 mix-blend-overlay z-10"></div>
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform hover:scale-105 duration-[30s]"
                        style={{ backgroundImage: `url(${config.background_url})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1e293b] z-20"></div>
                </div>

                {/* Right Panel: Content (SMALL - 33%) */}
                <div className="w-full lg:w-1/3 flex flex-col justify-center px-8 sm:px-12 py-12 bg-[#1e293b]">

                    {/* Header: Brand/Logo */}
                    <div className="flex flex-col items-start gap-4 mb-10">
                        <div
                            onClick={handleLogoClick}
                            className="flex items-center gap-3 cursor-pointer group"
                        >
                            {config.logo_url ? (
                                <img src={config.logo_url} alt="Logo" className="h-10 w-auto opacity-90 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <LifeBuoy className="text-cyan-400 h-10 w-10" />
                            )}
                        </div>
                        {/* Explicit Company Name */}
                        <div className="animate-fade-in">
                            <h2 className="text-xs font-bold tracking-[0.2em] text-cyan-500 uppercase">Alliance Structural</h2>
                            <h2 className="text-lg font-bold text-white tracking-tight">Engineers</h2>
                        </div>
                    </div>

                    {/* Main Text */}
                    <div className="mb-10 space-y-3">
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none">
                            Welcome <span className="text-cyan-400">Back.</span>
                        </h1>
                        <p className="text-slate-400 text-base leading-relaxed">
                            Report issues, request hardware, or track tickets in seconds.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4 w-full">
                        <button
                            onClick={() => navigate('/submit-ticket')}
                            className="w-full group relative flex items-center justify-center gap-3 px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-2xl font-bold text-base shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.6)] transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <LifeBuoy size={20} className="text-slate-900" />
                            <span>Submit Ticket</span>
                            <ArrowRight size={18} className="absolute right-6 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-slate-800" />
                        </button>

                        <div className="flex items-center gap-4 py-2">
                            <div className="h-px flex-1 bg-slate-700"></div>
                            <span className="text-slate-600 text-xs font-medium uppercase tracking-wider">or verify status</span>
                            <div className="h-px flex-1 bg-slate-700"></div>
                        </div>

                        <button
                            onClick={() => navigate('/track-ticket')}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#0f172a] border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 rounded-2xl font-bold text-base transition-all duration-300"
                        >
                            <Activity size={20} />
                            <span>Track Existing Ticket</span>
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-8 text-[10px] text-slate-600 font-medium">
                        &copy; 2026 Alliance Structural Engineers.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
