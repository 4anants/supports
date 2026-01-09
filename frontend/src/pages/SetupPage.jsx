import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle, XCircle, Loader } from 'lucide-react';

const SetupPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);

    const handleSetup = async () => {
        setLoading(true);
        setResults(null);
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

        try {
            const response = await fetch(`${API_URL}/health`);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setResults({
                status: 'Connected',
                database: data.database,
                email: data.email,
                timestamp: data.timestamp,
                errors: []
            });
        } catch (error) {
            setResults({
                status: 'Error',
                errors: [`Backend connection failed: ${error.message}`]
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mb-4">
                        <Activity size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Backend Health Check</h1>
                    <p className="text-gray-600">Verify your local server status</p>
                </div>

                {!results && !loading && (
                    <div className="text-center">
                        <p className="text-gray-700 mb-6">
                            Check if the local backend server and database are running correctly.
                        </p>
                        <button
                            onClick={handleSetup}
                            className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg"
                        >
                            Run Health Check
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="text-center py-12">
                        <Loader className="animate-spin mx-auto mb-4 text-blue-600" size={48} />
                        <p className="text-gray-600">Creating collections and seeding data...</p>
                    </div>
                )}

                {results && (
                    <div className="space-y-4">
                        {results.status === 'Connected' && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                                <h3 className="flex items-center gap-2 font-semibold text-green-800 mb-4">
                                    <CheckCircle size={20} />
                                    Server Status: Online
                                </h3>
                                <div className="space-y-2 text-sm text-green-700">
                                    <p><strong>Database:</strong> {results.database}</p>
                                    <p><strong>Email Service:</strong> {results.email}</p>
                                    <p><strong>Server Time:</strong> {new Date(results.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                        )}

                        {results.errors && results.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h3 className="flex items-center gap-2 font-semibold text-red-800 mb-2">
                                    <XCircle size={20} />
                                    Errors
                                </h3>
                                <ul className="space-y-1 text-sm text-red-700">
                                    {results.errors.map((error, i) => (
                                        <li key={i}>✗ {error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {results.errors && results.errors.length === 0 && results.status === 'Connected' && (
                            <div className="text-center pt-4">
                                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                                    <p className="text-green-800 font-semibold">🎉 All Systems Operational!</p>
                                    <p className="text-sm text-green-700 mt-1">Backup and local services are running</p>
                                </div>
                                <button
                                    onClick={() => navigate('/')}
                                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
                                >
                                    Go to Home
                                </button>
                            </div>
                        )}

                        {results.errors && results.errors.length > 0 && (
                            <div className="text-center pt-4">
                                <button
                                    onClick={handleSetup}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
                                >
                                    Retry Setup
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SetupPage;
