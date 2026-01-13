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
                    ? 'bg-[#f7f1e0] text-solarized-blue shadow-sm border-l-3 border-solarized-blue'
                    : 'text-solarized-base01 hover:bg-solarized-base2 hover:text-solarized-base02'
                }
            `}
        >
            {/* Active Indicator */}
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-solarized-blue rounded-r-full"></div>
            )}

            {/* Icon */}
            <div className={active ? 'text-solarized-blue' : ''}>
                <Icon size={20} />
            </div>

            {/* Label */}
            <span className="relative z-10">{label}</span>

            {/* Hover Effect */}
            <div className="absolute inset-0 bg-solarized-blue/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
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
        navigate('/admin/login');
    };

    const currentPath = location.pathname;

    return (
        <div className="h-screen overflow-hidden bg-solarized-base3 flex">
            {/* Sidebar */}
            <div className="w-72 bg-gradient-to-b from-solarized-base2 to-[#e8e1d0] border-r border-[#e3dcc8] flex flex-col shadow-solarized-lg">
                {/* Logo/Header */}
                <div className="p-6 border-b border-[#e3dcc8]">
                    <div className="flex items-center gap-3">
                        {/* Agent Avatar / Logo */}
                        <div className="w-14 h-14 bg-[#e6dfc8] rounded-full flex items-center justify-center border-2 border-white shadow-sm text-solarized-base01">
                            <User size={28} />
                        </div>

                        {/* Agent Details */}
                        <div className="overflow-hidden">
                            <h2 className="text-lg font-bold text-solarized-base02 leading-tight truncate" title={user?.name}>
                                {user?.name || 'Administrator'}
                            </h2>
                            <p className="text-xs text-solarized-base01 truncate" title={user?.email}>
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {/* Role Badge */}
                    <div className="mt-3 px-3 py-1.5 bg-solarized-cyan/10 border border-solarized-cyan/20 rounded-lg text-xs font-bold text-solarized-cyan text-center uppercase tracking-wide">
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
                <div className="p-4 border-t border-[#e3dcc8]">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-solarized-red/10 hover:bg-solarized-red/20 text-solarized-red font-medium transition-all duration-300"
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
