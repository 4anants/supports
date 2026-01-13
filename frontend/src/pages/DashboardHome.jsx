import { useEffect, useState } from 'react';
import api from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import {
    Loader2, TrendingUp, AlertCircle, Building2, FileText, CheckCircle,
    Clock, Plus, Users, Settings, ArrowRight, Activity, Database, Cloud
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ label, value, subtext, color, gradient, icon: Icon, trend }) => (
    <div className="group relative bg-[#1e293b] p-6 rounded-2xl shadow-sm border border-slate-700/50 hover:shadow-md transition-all duration-300 overflow-hidden">
        {/* Gradient Accent */}
        <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: gradient }}></div>

        <div className="relative z-10 flex justify-between items-start">
            <div>
                <p className="text-sm font-semibold text-slate-400 mb-1 tracking-wide uppercase">{label}</p>
                <h3 className="text-3xl font-extrabold text-white tracking-tight">{value}</h3>
                {subtext && <p className="text-xs text-slate-500 mt-2 font-medium">{subtext}</p>}

                {trend && (
                    <div className="flex items-center gap-1 mt-3 px-2 py-1 bg-green-900/30 text-green-400 rounded-full w-fit text-xs font-bold border border-green-500/20">
                        <TrendingUp size={12} /> {trend}
                    </div>
                )}
            </div>

            <div className="p-3 rounded-xl shadow-inner bg-slate-800/50">
                <Icon size={24} style={{ color }} />
            </div>
        </div>

        {/* Decorative Background Icon */}
        <Icon
            size={120}
            className="absolute -bottom-6 -right-6 opacity-5 group-hover:scale-110 transition-transform duration-500 text-white rotate-12"
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
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">Executive Overview</h2>
                    <p className="text-slate-400 mt-1">Real-time metrics and system health monitoring.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition" title="Refresh Data">
                        <Activity size={20} />
                    </button>
                    <div className="hidden md:flex bg-[#1e293b] border border-slate-700 rounded-lg p-1">
                        <span className="px-3 py-1 text-xs font-bold bg-[#0f172a] text-slate-200 rounded shadow-sm border border-slate-600">Last 30 Days</span>
                        <span className="px-3 py-1 text-xs font-medium text-slate-500">All Time</span>
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

            {/* Main Content Grid - 3 Column Layout (Bento Style) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Main Operational Section (Span 9) */}
                <div className="lg:col-span-9 space-y-6">

                    {/* Top Row: Quick Info & Distribution */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Quick Actions */}
                        <div className="bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700/50 flex flex-col h-full">
                            <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                                <Activity size={18} className="text-cyan-500" /> Quick Actions
                            </h3>
                            <div className="grid grid-cols-2 gap-3 flex-1">
                                <Link to="/dashboard/tickets" className="flex flex-col items-center justify-center p-3 bg-[#0f172a] hover:bg-slate-800 rounded-xl transition shadow-sm border border-slate-700 group">
                                    <Plus size={20} className="mb-2 text-cyan-500 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">New Ticket</span>
                                </Link>
                                <Link to="/dashboard/inventory" className="flex flex-col items-center justify-center p-3 bg-[#0f172a] hover:bg-slate-800 rounded-xl transition shadow-sm border border-slate-700 group">
                                    <FileText size={20} className="mb-2 text-purple-500 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Inventory</span>
                                </Link>
                                <Link to="/dashboard/settings" className="flex flex-col items-center justify-center p-3 bg-[#0f172a] hover:bg-slate-800 rounded-xl transition shadow-sm border border-slate-700 group">
                                    <Users size={20} className="mb-2 text-green-500 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Users</span>
                                </Link>
                                <Link to="/dashboard/settings" className="flex flex-col items-center justify-center p-3 bg-[#0f172a] hover:bg-slate-800 rounded-xl transition shadow-sm border border-slate-700 group">
                                    <Settings size={20} className="mb-2 text-amber-500 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Settings</span>
                                </Link>
                            </div>
                        </div>

                        {/* Backup Status */}
                        <div className="bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700/50 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-white text-sm">Backup Health</h3>
                                {backupStatus && (
                                    <span className={`h-2 w-2 rounded-full ${backupStatus.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                )}
                            </div>
                            {backupStatus ? (
                                <div className="text-center flex-1 flex flex-col justify-center items-center">
                                    <div className={`inline-flex items-center justify-center p-3 rounded-full mb-3 ${backupStatus.status === 'SUCCESS' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                        <Database size={24} />
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Last Backup</p>
                                    <p className="text-sm font-bold text-white mb-3">{new Date(backupStatus.timestamp).toLocaleDateString()}</p>
                                    <Link to="/dashboard/settings?tab=backups" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline">Manage Backups</Link>
                                </div>
                            ) : (
                                <div className="text-center text-slate-500 text-xs flex-1 flex items-center justify-center">No Data</div>
                            )}
                        </div>

                        {/* Categories (Moved from Center) */}
                        <div className="bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700/50 flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp size={18} className="text-purple-500" />
                                <h3 className="font-bold text-white text-sm">Categories</h3>
                            </div>
                            <div className="w-full h-[160px] min-w-0 flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.byType}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            dataKey="count"
                                        >
                                            {stats.byType.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                        <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#cbd5e1' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Wide Chart */}
                    <div className="bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 size={18} className="text-cyan-500" />
                            <h3 className="font-bold text-white text-sm">Tickets by Office</h3>
                        </div>
                        <div className="w-full h-[220px] min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.byOffice} barSize={40}>
                                    <XAxis dataKey="office" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                                    <Tooltip cursor={{ fill: '#334155' }} contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                    <Bar dataKey="count" radius={[6, 6, 6, 6]}>
                                        {stats.byOffice.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Column: Activity (Span 3) */}
                <div className="lg:col-span-3 h-full">
                    <div className="bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700/50 h-full max-h-[600px] flex flex-col">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h3 className="font-bold text-white text-sm flex items-center gap-2">
                                <Clock size={16} className="text-pink-500" /> Recent Feed
                            </h3>
                            <Link to="/dashboard/tickets" className="text-[10px] font-bold text-cyan-400 hover:underline">View All</Link>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                            {recentTickets.length > 0 ? (
                                recentTickets.map(ticket => (
                                    <div key={ticket.id} className="p-3 hover:bg-[#0f172a] rounded-lg border border-slate-700/30 flex flex-col gap-1 transition-colors group">
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-bold text-slate-200">{ticket.visual_id || ticket.generated_id}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${ticket.status === 'Open' ? 'bg-red-900/30 text-red-500' : ticket.status === 'Resolved' ? 'bg-green-900/30 text-green-500' : 'bg-amber-900/30 text-amber-500'}`}>{ticket.status}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate">{ticket.description}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[10px] text-slate-500">{ticket.full_name}</span>
                                            <span className="text-[9px] text-slate-600">{new Date(ticket.created).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-500 text-xs py-10">No recent activity.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
