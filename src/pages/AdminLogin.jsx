import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import pb from '../lib/pocketbase';
import { useConfig } from '../contexts/ConfigContext';
// Note: Assuming useConfig is available, if not we can use pb directly or props. 
// Actually, looking at the code, it fetches settings manually. 
// I will keep the imports minimal.

const AdminLogin = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [config, setConfig] = useState({ background_url: '', company_name: '' });
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // Strict Access Control: Must come from secret action
        if (!location.state?.fromSecretAction) {
            navigate('/', { replace: true });
            return;
        }

        /* Fetch config for branding */
        /* Fetch config for branding */
        pb.collection('settings').getFullList()
            .then(records => {
                const settingsMap = {};
                records.forEach(record => {
                    if (record.key && record.value) settingsMap[record.key] = record.value;
                });
                setConfig(settingsMap);
            })
            .catch(() => {
                console.log('Could not fetch settings');
            });
    }, [location, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // Authenticate against 'users' collection
            const authData = await pb.collection('users').authWithPassword(username, password);

            // Access user data from the record
            const userRecord = authData.record;

            const adminUser = {
                username: userRecord.username || userRecord.email,
                full_name: userRecord.full_name || 'System Admin',
                email: userRecord.email,
                role: userRecord.role || 'Admin', // Default to Admin if not set, but it should be set
                id: userRecord.id
            };

            localStorage.setItem('token', authData.token);
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
        <div className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4" style={{ backgroundImage: `url(${config.background_url})` }}>
            {/* Overlay for better contrast */}
            <div className="absolute inset-0 bg-black/20"></div>

            <div className="bg-white/95 p-8 rounded-2xl shadow-xl w-full max-w-sm relative z-10">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                        <Lock />
                    </div>
                    <h2 className="text-xl font-bold">Admin Access</h2>
                    <p className="text-sm text-gray-500">{config.company_name}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
                    <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                        Login
                    </button>
                    <div className="text-center text-xs text-gray-400 mt-4">
                        Login with your admin email
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
