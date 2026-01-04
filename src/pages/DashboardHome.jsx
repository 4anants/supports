import { useEffect, useState } from 'react';
import pb from '../lib/pocketbase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2, TrendingUp, AlertCircle, Building2, FileText } from 'lucide-react';

const StatCard = ({ label, value, color, gradient, icon: Icon }) => (
    <div className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover-lift smooth-transition overflow-hidden">
        {/* Gradient Accent Border */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: gradient }}></div>

        {/* Icon Background Circle */}
        <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-5" style={{ background: gradient }}></div>

        <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
                    <Icon size={20} style={{ color }} />
                </div>
            </div>
            <h3 className="text-4xl font-bold" style={{ color }}>{value}</h3>
        </div>

        {/* Hover Glow Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 50%, ${color}08, transparent 70%)` }}>
        </div>
    </div>
);

// Ocean Blue Professional Color Palette
const OCEAN_COLORS = ['#06B6D4', '#1E40AF', '#7C3AED', '#10B981', '#FBBF24', '#FB7185'];

const DashboardHome = () => {
    const [stats, setStats] = useState(null);

    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const tickets = await pb.collection('tickets').getFullList();

                const total = tickets.length;
                const open = tickets.filter(t => t.status === 'Open').length;

                // Group by Office
                const officeMap = {};
                tickets.forEach(t => {
                    const off = t.office || 'Unknown';
                    officeMap[off] = (officeMap[off] || 0) + 1;
                });
                const byOffice = Object.entries(officeMap).map(([office, count]) => ({ office, count }));

                // Group by Type
                const typeMap = {};
                tickets.forEach(t => {
                    const type = t.type || 'Other';
                    typeMap[type] = (typeMap[type] || 0) + 1;
                });
                const byType = Object.entries(typeMap).map(([name, count]) => ({ name, count }));

                setStats({ total, open, byOffice, byType });
            } catch (err) {
                console.error("Dashboard Stats Error:", err);
                setError(err.message || "Failed to load dashboard data");
            }
        };
        fetchStats();
    }, []);

    if (error) return (
        <div className="flex items-center justify-center p-12">
            <div className="text-center text-red-500">
                <AlertCircle className="mx-auto mb-3" size={40} />
                <h3 className="text-lg font-bold">Error Loading Dashboard</h3>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-100 rounded hover:bg-red-200">Retry</button>
            </div>
        </div>
    );

    if (!stats || !stats.byOffice) return (
        <div className="flex items-center justify-center p-12">
            <div className="text-center">
                <Loader2 className="animate-spin text-cyan-500 mx-auto mb-3" size={40} />
                <p className="text-gray-500">Loading dashboard...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h2 className="text-3xl font-bold gradient-text mb-2">Dashboard Overview</h2>
                <p className="text-gray-500">Monitor your IT support metrics and insights</p>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Total Tickets"
                    value={stats.total}
                    color="#1E293B"
                    gradient="linear-gradient(135deg, #1E293B 0%, #475569 100%)"
                    icon={FileText}
                />
                <StatCard
                    label="Open Tickets"
                    value={stats.open}
                    color="#FB7185"
                    gradient="linear-gradient(135deg, #FB7185 0%, #EF4444 100%)"
                    icon={AlertCircle}
                />
                <StatCard
                    label="Offices"
                    value={stats.byOffice.length}
                    color="#06B6D4"
                    gradient="linear-gradient(135deg, #06B6D4 0%, #1E40AF 100%)"
                    icon={Building2}
                />
                <StatCard
                    label="Request Types"
                    value={stats.byType.length}
                    color="#10B981"
                    gradient="linear-gradient(135deg, #10B981 0%, #059669 100%)"
                    icon={TrendingUp}
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                {/* Bar Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover-lift smooth-transition">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 via-blue-600 to-purple-600 rounded-full"></div>
                        <h3 className="font-bold text-gray-800 text-lg">Requests by Office</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={stats.byOffice}>
                            <XAxis
                                dataKey="office"
                                tick={{ fill: '#64748B', fontSize: 12 }}
                                axisLine={{ stroke: '#E2E8F0' }}
                            />
                            <YAxis
                                tick={{ fill: '#64748B', fontSize: 12 }}
                                axisLine={{ stroke: '#E2E8F0' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: 'white',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Bar
                                dataKey="count"
                                fill="url(#oceanGradient)"
                                radius={[8, 8, 0, 0]}
                            />
                            <defs>
                                <linearGradient id="oceanGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#06B6D4" />
                                    <stop offset="100%" stopColor="#1E40AF" />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Pie Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover-lift smooth-transition">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1 h-6 bg-gradient-to-b from-purple-500 via-blue-600 to-cyan-600 rounded-full"></div>
                        <h3 className="font-bold text-gray-800 text-lg">Request Types</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={stats.byType}
                                cx="50%"
                                cy="45%"
                                innerRadius={65}
                                outerRadius={95}
                                paddingAngle={4}
                                dataKey="count"
                            >
                                {stats.byType.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={OCEAN_COLORS[index % OCEAN_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    background: 'white',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;

