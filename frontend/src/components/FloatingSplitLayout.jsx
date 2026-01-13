import React from 'react';
import { useConfig } from '../contexts/ConfigContext';

/**
 * FloatingSplitLayout
 * A synchronized layout component for public-facing pages (Landing, Ticket Tracker, Ticket Submission).
 * Features a dark theme, a large background image panel (left), and a content panel (right).
 */
const FloatingSplitLayout = ({ children, contentClassName = "" }) => {
    const { config } = useConfig();

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] p-4 font-sans text-slate-200">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-[#0f172a] z-0">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-cyan-900/10 to-transparent opacity-40"></div>
            </div>

            {/* Main Floating Card */}
            <div className="relative z-10 flex w-full max-w-7xl h-[650px] bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50">

                {/* Left Panel: Image (BIG - 66%) */}
                <div className="hidden lg:block w-2/3 relative">
                    <div className="absolute inset-0 bg-cyan-900/20 mix-blend-overlay z-10"></div>
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform hover:scale-105 duration-[30s]"
                        style={{ backgroundImage: `url(${config.background_url})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1e293b] z-20"></div>
                </div>

                {/* Right Panel: Content (SMALL - 33%) */}
                <div className={`w-full lg:w-1/3 flex flex-col justify-center px-8 sm:px-12 py-12 bg-[#1e293b] ${contentClassName}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default FloatingSplitLayout;
