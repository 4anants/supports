import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import api from '../lib/api';

const AdminLogin = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [config, setConfig] = useState({ background_url: '', company_name: '' });
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Strict Access Control: Must come from secret action
        if (!location.state?.fromSecretAction) {
            navigate('/', { replace: true });
            return;
        }

        // Fetch config for branding
        api.getSettings()
            .then(settings => {
                setConfig(settings);
            })
            .catch(() => {
                // Settings might be missing on first run, handle gracefully
            });
    }, [location, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Authenticate with new backend
            const authData = await api.login(username, password);

            const adminUser = {
                username: authData.user.username || authData.user.email,
                name: authData.user.name || 'System Admin',
                email: authData.user.email,
                role: authData.user.role || 'Admin',
                id: authData.user.id
            };

            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('adminUser', JSON.stringify(adminUser));

            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError('Login failed: Invalid credentials or server error.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-[#0f172a] font-sans text-slate-200 flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-cyan-900/10 to-transparent opacity-30"></div>
            </div>

            <div className="w-full max-w-md bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50 relative z-10">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-cyan-900/20 to-slate-900/20 p-8 border-b border-slate-700/50 flex flex-col items-center">
                    <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_15px_-3px_rgba(34,211,238,0.2)]">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">Admin Access</h2>
                    <p className="text-slate-400 text-sm">{config.company_name || 'Secure Login'}</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Username or Email</label>
                            <input
                                type="text"
                                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter your admin ID"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
                            <input
                                type="password"
                                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl font-bold transition-all shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                                    <span>Verifying...</span>
                                </>
                            ) : (
                                'Sign In to Dashboard'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-slate-500">
                            Protected System • Authorized Personnel With PIN Access Only
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
