import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../contexts/ConfigContext';
import { LifeBuoy } from 'lucide-react';

const LandingPage = () => {
    const { config, loading } = useConfig();
    const navigate = useNavigate();
    const [clickCount, setClickCount] = useState(0);

    const handleLogoClick = () => {
        setClickCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 5) {
                navigate('/admin', { state: { fromSecretAction: true } });
                return 0;
            }
            return newCount;
        });
    };

    if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

    return (
        <div className="relative h-screen w-full overflow-hidden bg-gray-900">
            {/* Background with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-40 transition-opacity duration-1000"
                style={{ backgroundImage: `url(${config.background_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900/90" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center pb-40">
                {config.logo_url ? (
                    <img
                        src={config.logo_url}
                        alt="Logo"
                        className="h-24 mb-6 drop-shadow-lg cursor-default select-none transition-transform active:scale-95"
                        onClick={handleLogoClick}
                    />
                ) : (
                    // Fallback Icon for Fresh Install (Allows Secret Click)
                    <div
                        onClick={handleLogoClick}
                        className="h-24 w-24 mb-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg cursor-default transition-transform active:scale-95"
                    >
                        <LifeBuoy size={48} className="text-white" />
                    </div>
                )}
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight flex flex-col items-center">
                    <span>{config.company_name}</span>
                    <span className="text-blue-400 mt-12">IT Support</span>
                </h1>
                <p className="text-xl text-gray-300 mb-8 max-w-2xl">
                    Fast, reliable technical assistance for all employees.
                    Report issues or request hardware in seconds.
                </p>

                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/submit-ticket')}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
                    >
                        <LifeBuoy size={20} />
                        Submit a Ticket
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
