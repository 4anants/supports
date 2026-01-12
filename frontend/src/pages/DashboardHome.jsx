import { useEffect, useState } from 'react';
import api from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import {
    Loader2, TrendingUp, AlertCircle, Building2, FileText, CheckCircle,
    Clock, Plus, Users, Settings, ArrowRight, Activity, Database, Cloud
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ label, value, subtext, color, gradient, icon: Icon, trend }) => (
    <div className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 overflow-hidden">
        {/* Gradient Accent */}
        <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: gradient }}></div>

        <div className="relative z-10 flex justify-between items-start">
            <div>
                <p className="text-sm font-semibold text-gray-500 mb-1 tracking-wide uppercase">{label}</p>
                <h3 className="text-3xl font-extrabold text-gray-800 tracking-tight">{value}</h3>
                {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}

                {trend && (
                    <div className="flex items-center gap-1 mt-3 px-2 py-1 bg-green-50 text-green-700 rounded-full w-fit text-xs font-bold">
                        <TrendingUp size={12} /> {trend}
                    </div>
                )}
            </div>

            <div className="p-3 rounded-xl shadow-inner" style={{ background: `${color}10` }}>
                <Icon size={24} style={{ color }} />
            </div>
        </div>

        {/* Decorative Background Icon */}
        <Icon
            size={120}
            className="absolute -bottom-6 -right-6 opacity-5 group-hover:scale-110 transition-transform duration-500 text-gray-500 rotate-12"
        />
    </div>
);

const ActivityItem = ({ ticket }) => (
    <div className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0">
        <div className={`p-2 rounded-lg shrink-0 ${ticket.status === 'Open' ? 'bg-red-100 text-red-600' :
            ticket.status === 'In Progress' ? 'bg-amber-100 text-amber-600' :
                'bg-green-100 text-green-600'
            }`}>
            {ticket.status === 'Open' ? <AlertCircle size={18} /> :
                ticket.status === 'In Progress' ? <Clock size={18} /> :
                    <CheckCircle size={18} />}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-800 truncate">{ticket.generated_id} - {ticket.type || 'Ticket'}</h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{ticket.full_name || 'Unknown User'}</span>
                <span>•</span>
                <span>{new Date(ticket.created).toLocaleDateString()}</span>
                <span>•</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ticket.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {ticket.priority}
                </span>
            </div>
        </div>
        <Link to={`/dashboard/tickets?id=${ticket.id}`} className="text-gray-300 hover:text-blue-600 transition-colors">
            <ArrowRight size={16} />
        </Link>
    </div>
);


// Ocean Blue Professional Color Palette
const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'];

const DashboardHome = () => {
    const [stats, setStats] = useState(null);
    const [recentTickets, setRecentTickets] = useState([]);
    const [backupStatus, setBackupStatus] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const tickets = await api.getTickets();

                // Sort by date desc
                const sorted = [...tickets].sort((a, b) => new Date(b.created) - new Date(a.created));
                setRecentTickets(sorted.slice(0, 5));

                const total = tickets.length;
                const open = tickets.filter(t => t.status === 'Open').length;
                const resolved = tickets.filter(t => t.status === 'Resolved' || t.status === 'Solved').length;
                const inProgress = tickets.filter(t => t.status === 'In Progress' || t.status === 'Pending').length;

                // Group by Office
                const officeMap = {};
                tickets.forEach(t => {
                    const off = t.office || 'Unknown';
                    officeMap[off] = (officeMap[off] || 0) + 1;
                });
                const byOffice = Object.entries(officeMap)
                    .map(([office, count]) => ({ office, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 6); // Top 6

                // Group by Type
                const typeMap = {};
                tickets.forEach(t => {
                    const type = t.type || 'Other';
                    typeMap[type] = (typeMap[type] || 0) + 1;
                });
                const byType = Object.entries(typeMap).map(([name, count]) => ({ name, count }));

                setStats({ total, open, closed: resolved, inProgress, byOffice, byType });

                // Fetch latest backup status
                try {
                    const backups = await api.get('/settings/backups');
                    if (backups && backups.length > 0) {
                        setBackupStatus(backups[0]); // Most recent
                    }
                } catch (backupErr) {
                    console.warn('Failed to fetch backup status:', backupErr);
                }
            } catch (err) {
                console.error("Dashboard Stats Error:", err);
                setError(err.message || "Failed to load dashboard data");
            }
        };
        fetchStats();
    }, []);

    if (error) return (
        <div className="flex items-center justify-center p-12 h-96">
            <div className="text-center text-red-500 bg-red-50 p-8 rounded-2xl">
                <AlertCircle className="mx-auto mb-4" size={48} />
                <h3 className="text-xl font-bold mb-2">Error Loading Dashboard</h3>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition">Retry</button>
            </div>
        </div>
    );

    if (!stats) return (
        <div className="flex items-center justify-center p-12 h-96">
            <div className="text-center">
                <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
                <p className="text-gray-500 font-medium">Gathering insights...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-12">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-800 tracking-tight">Executive Overview</h2>
                    <p className="text-gray-500 mt-1">Real-time metrics and system health monitoring.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => window.location.reload()} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Refresh Data">
                        <Activity size={20} />
                    </button>
                    <div className="hidden md:flex bg-white border border-gray-200 rounded-lg p-1">
                        <span className="px-3 py-1 text-xs font-bold bg-gray-100 text-gray-600 rounded">Last 30 Days</span>
                        <span className="px-3 py-1 text-xs font-medium text-gray-400">All Time</span>
                    </div>
                </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Total Volume"
                    value={stats.total}
                    subtext="All time tickets"
                    color="#6366f1"
                    gradient="linear-gradient(to bottom, #6366f1, #4f46e5)"
                    icon={FileText}
                    trend="+12% vs last month"
                />
                <StatCard
                    label="Action Required"
                    value={stats.open}
                    subtext="Open tickets"
                    color="#ef4444"
                    gradient="linear-gradient(to bottom, #ef4444, #dc2626)"
                    icon={AlertCircle}
                    trend="Needs Attention"
                />
                <StatCard
                    label="In Progress"
                    value={stats.inProgress}
                    subtext="Currently being worked on"
                    color="#f59e0b"
                    gradient="linear-gradient(to bottom, #f59e0b, #d97706)"
                    icon={Clock}
                />
                <StatCard
                    label="Resolved"
                    value={stats.closed}
                    subtext="Successfully closed"
                    color="#10b981"
                    gradient="linear-gradient(to bottom, #10b981, #059669)"
                    icon={CheckCircle}
                    trend="+5% Efficiency"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Charts Column (Span 2) */}
                <div className="xl:col-span-2 space-y-8 min-w-0">
                    {/* Bar Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <Building2 size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Ticket Distribution by Office</h3>
                        </div>
                        <div style={{ width: '100%', height: 320 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.byOffice} barSize={40}>
                                    <XAxis
                                        dataKey="office"
                                        tick={{ fill: '#64748B', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        hide
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#F1F5F9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Bar
                                        dataKey="count"
                                        radius={[8, 8, 8, 8]}
                                    >
                                        {stats.byOffice.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pie Chart Row */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                <TrendingUp size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Request Categories</h3>
                        </div>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.byType}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        paddingAngle={5}
                                        dataKey="count"
                                    >
                                        {stats.byType.map((entry, index) => (
                                            <Cell key={`cell-${index}`} step={3} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Column: Activity & Actions (Span 1) */}
                <div className="space-y-8 min-w-0">
                    {/* Quick Actions */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl shadow-lg text-white">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Activity size={20} className="text-blue-400" /> Quick Actions
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <Link to="/dashboard/tickets" className="flex flex-col items-center justify-center p-4 bg-white/10 hover:bg-white/20 rounded-xl transition backdrop-blur-sm border border-white/10">
                                <Plus size={24} className="mb-2 text-blue-300" />
                                <span className="text-xs font-bold">New Ticket</span>
                            </Link>
                            <Link to="/dashboard/inventory" className="flex flex-col items-center justify-center p-4 bg-white/10 hover:bg-white/20 rounded-xl transition backdrop-blur-sm border border-white/10">
                                <FileText size={24} className="mb-2 text-purple-300" />
                                <span className="text-xs font-bold">Inventory</span>
                            </Link>
                            {/* Pointing to settings as User Management is likely a tab there */}
                            <Link to="/dashboard/settings" className="flex flex-col items-center justify-center p-4 bg-white/10 hover:bg-white/20 rounded-xl transition backdrop-blur-sm border border-white/10">
                                <Users size={24} className="mb-2 text-green-300" />
                                <span className="text-xs font-bold">Manage Users</span>
                            </Link>
                            <Link to="/dashboard/settings" className="flex flex-col items-center justify-center p-4 bg-white/10 hover:bg-white/20 rounded-xl transition backdrop-blur-sm border border-white/10">
                                <Settings size={24} className="mb-2 text-amber-300" />
                                <span className="text-xs font-bold">Settings</span>
                            </Link>
                        </div>
                    </div>

                    {/* Backup Status Widget */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${backupStatus?.status === 'SUCCESS' ? 'bg-green-50 text-green-600' :
                                backupStatus?.status === 'FAILED' ? 'bg-red-50 text-red-600' :
                                    'bg-gray-50 text-gray-600'}`}>
                                <Database size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Backup Status</h3>
                        </div>

                        {backupStatus ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm font-medium text-gray-600">Last Backup</span>
                                    <span className="text-sm font-bold text-gray-800">{new Date(backupStatus.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm font-medium text-gray-600">Status</span>
                                    <span className={`text-sm font-bold uppercase px-2 py-1 rounded ${backupStatus.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                                            backupStatus.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {backupStatus.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm font-medium text-gray-600">Type</span>
                                    <div className="flex items-center gap-1">
                                        {backupStatus.type === 'CLOUD' && <Cloud size={14} className="text-blue-600" />}
                                        <span className="text-sm font-bold text-gray-800">{backupStatus.type || 'LOCAL'}</span>
                                    </div>
                                </div>
                                <Link
                                    to="/dashboard/settings?tab=backups"
                                    className="block w-full text-center px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition text-sm"
                                >
                                    View All Backups
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Database size={32} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-sm text-gray-400 font-medium">No backup history available</p>
                                <Link
                                    to="/dashboard/settings?tab=backups"
                                    className="inline-block mt-3 text-xs text-blue-600 hover:underline font-bold"
                                >
                                    Configure Backups
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-pink-50 rounded-lg text-pink-600">
                                    <Clock size={20} />
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg">Recent Feed</h3>
                            </div>
                            <Link to="/dashboard/tickets" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">View All</Link>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                            {recentTickets.length > 0 ? (
                                recentTickets.map(ticket => <ActivityItem key={ticket.id} ticket={ticket} />)
                            ) : (
                                <p className="text-center text-gray-400 text-sm mt-12">No recent activity found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
