import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Ticket, Package, BarChart3, Settings, LogOut, User } from 'lucide-react';
import api from '../lib/api';
import { useConfig } from '../contexts/ConfigContext';

import DashboardHome from './DashboardHome';
import DashboardTickets from './DashboardTickets';
import DashboardInventory from './DashboardInventory';
import DashboardSettings from './DashboardSettings';

const SidebarItem = ({ icon: Icon, label, path, active }) => {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(path)}
            className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl 
                transition-all duration-300 font-medium relative overflow-hidden group
                ${active
                    ? 'bg-slate-800/80 text-cyan-400 shadow-md border-l-4 border-cyan-500'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }
            `}
        >
            {/* Active Indicator */}
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
            )}

            {/* Icon */}
            <div className={active ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}>
                <Icon size={20} />
            </div>

            {/* Label */}
            <span className="relative z-10">{label}</span>

            {/* Hover Effect */}
            <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
        </button>
    );
};

// Sub-components within the same file for ease of generation for now, or imported.
// I will generate the sub-pages separately for cleaner code, but `AdminDashboard` serves as the router and layout holder.

const AdminDashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { config } = useConfig();
    const user = JSON.parse(localStorage.getItem('adminUser'));
    const role = user?.role || 'Admin';

    const handleLogout = () => {
        localStorage.removeItem('adminUser');
        navigate('/admin');
    };

    const currentPath = location.pathname;

    return (
        <div className="h-screen overflow-hidden bg-[#0f172a] text-slate-200 flex font-sans">
            {/* Sidebar */}
            <div className="w-72 bg-[#1e293b] border-r border-slate-700/50 flex flex-col shadow-2xl z-20">
                {/* Logo/Header */}
                <div className="p-6 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        {/* Agent Avatar / Logo */}
                        {user?.avatar ? (
                            <img
                                src={user.avatar}
                                alt="Profile"
                                className="w-14 h-14 rounded-full object-cover border-2 border-slate-600 shadow-md"
                            />
                        ) : (
                            <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center border-2 border-slate-600 shadow-inner text-slate-400">
                                <User size={28} />
                            </div>
                        )}

                        {/* Agent Details */}
                        <div className="overflow-hidden">
                            <h2 className="text-lg font-bold text-slate-100 leading-tight truncate" title={user?.name || user?.full_name}>
                                {user?.name || user?.full_name || 'Administrator'}
                            </h2>
                            <p className="text-xs text-slate-400 truncate" title={user?.email}>
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {/* Role Badge */}
                    <div className="mt-4 px-3 py-1.5 bg-cyan-900/30 border border-cyan-500/20 rounded-lg text-xs font-bold text-cyan-400 text-center uppercase tracking-wider shadow-sm">
                        {role}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    <SidebarItem
                        icon={LayoutDashboard}
                        label="Overview"
                        path="/dashboard"
                        active={currentPath === '/dashboard'}
                    />
                    <SidebarItem
                        icon={Ticket}
                        label="Tickets"
                        path="/dashboard/tickets"
                        active={currentPath.includes('/dashboard/tickets')}
                    />
                    <SidebarItem
                        icon={Package}
                        label="Inventory"
                        path="/dashboard/inventory"
                        active={currentPath.includes('/dashboard/inventory')}
                    />
                    <SidebarItem
                        icon={Settings}
                        label="Settings"
                        path="/dashboard/settings"
                        active={currentPath.includes('/dashboard/settings')}
                    />
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-slate-700/50">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-medium transition-all duration-300 border border-transparent hover:border-red-500/20"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-8">
                    <Routes>
                        <Route path="/" element={<DashboardHome />} />
                        <Route path="/tickets" element={<DashboardTickets />} />
                        <Route path="/inventory" element={<DashboardInventory />} />
                        <Route path="/settings" element={<DashboardSettings />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
