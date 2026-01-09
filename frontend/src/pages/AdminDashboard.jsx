import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Ticket, Package, BarChart3, Settings, LogOut } from 'lucide-react';

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
                    ? 'bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
            `}
        >
            {/* Active Indicator */}
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-500 via-blue-600 to-purple-600 rounded-r-full"></div>
            )}

            {/* Icon with gradient on active */}
            <div className={`${active ? 'gradient-text' : ''}`}>
                <Icon size={20} />
            </div>

            {/* Label */}
            <span className="relative z-10">{label}</span>

            {/* Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-blue-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:via-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300 rounded-xl"></div>
        </button>
    );
};

// Sub-components within the same file for ease of generation for now, or imported.
// I will generate the sub-pages separately for cleaner code, but `AdminDashboard` serves as the router and layout holder.

const AdminDashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('adminUser'));
    const role = user?.role || 'Admin';

    const handleLogout = () => {
        api.logout();
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminUser');
        navigate('/admin');
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-lg">
                {/* Gradient Header */}
                <div className="relative mb-6 px-6 pt-6 pb-8 overflow-hidden">
                    {/* Animated Gradient Background */}
                    <div className="absolute inset-0 animated-gradient opacity-90"></div>

                    {/* Content */}
                    <div className="relative z-10">
                        <h1 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">Admin Panel</h1>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white/95">{user?.full_name || 'Admin'}</span>
                            <span className="text-xs text-white/80 bg-white/20 px-2.5 py-1 rounded-full w-fit mt-1.5 backdrop-blur-sm border border-white/30">{role}</span>
                        </div>
                    </div>

                    {/* Decorative Wave */}
                    <div className="absolute bottom-0 left-0 right-0 h-8">
                        <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#ffffff" opacity="0.25"></path>
                        </svg>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1.5">
                    <SidebarItem icon={LayoutDashboard} label="Overview" path="/dashboard" active={location.pathname === '/dashboard'} />
                    <SidebarItem icon={Ticket} label="Tickets" path="/dashboard/tickets" active={location.pathname.includes('/tickets')} />
                    <SidebarItem icon={Package} label="Inventory" path="/dashboard/inventory" active={location.pathname.includes('/inventory')} />
                    {role === 'Admin' && (
                        <SidebarItem icon={Settings} label="Settings" path="/dashboard/settings" active={location.pathname.includes('/settings')} />
                    )}
                </nav>

                <button
                    onClick={handleLogout}
                    className="mx-4 mb-6 flex items-center justify-center gap-3 px-4 py-3 text-rose-500 hover:text-white bg-rose-50 hover:bg-gradient-to-r hover:from-rose-500 hover:to-pink-500 rounded-xl transition-all duration-300 font-medium shadow-sm hover:shadow-md"
                >
                    <LogOut size={20} />
                    Logout
                </button>
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
