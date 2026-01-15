import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { Search, Filter, MoreVertical, ExternalLink, Check, Clock, Download, Trash2, X, Shield, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../contexts/ConfigContext';


const DashboardTickets = () => {
    const { config } = useConfig();
    const navigate = useNavigate();

    // Finalized Table Configuration
    const [tableConfig] = useState({
        fontSizeHeader: 14,
        fontSizeBody: 15,
        minTableWidth: 1200,
        fitToScreen: true,
        colWidths: {
            checkbox: 34,
            id: 56,
            requester: 140,
            description: 178,
            remarks: 150,
            location: 102,
            device: 119,
            agent: 90,
            timeline: 163,
            priority: 90,
            status: 110,
            actions: 32
        }
    });

    // PIN Protection State
    const [pinStatus, setPinStatus] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pendingAction, setPendingAction] = useState(null); // { type: 'DELETE_TICKET' | 'BULK_DELETE', payload: id | count }

    const [tickets, setTickets] = useState([]);
    const [filteredTickets, setFilteredTickets] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [stats, setStats] = useState({ total: 0, open: 0, closed: 0, pending: 0, onHold: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // New Filters
    const [showResolved, setShowResolved] = useState(false);
    const [locationFilter, setLocationFilter] = useState('all');

    // Derived unique locations for dropdown
    const uniqueLocations = [...new Set(tickets.map(t => t.office).filter(Boolean))].sort();

    // Multi-selection state
    const [selectedTickets, setSelectedTickets] = useState([]);

    const [activeMenu, setActiveMenu] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    // Fulfillment Modal State
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [remarksTicket, setRemarksTicket] = useState(null); // For admin remarks modal

    // Status change modal state
    const [statusChangeTicket, setStatusChangeTicket] = useState(null);
    const [statusChangeRemarks, setStatusChangeRemarks] = useState('');
    const [newStatus, setNewStatus] = useState('');

    const [selectedItem, setSelectedItem] = useState('');
    const [showItemSelectionModal, setShowItemSelectionModal] = useState(false);
    const [itemSearch, setItemSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);


    const fetchData = async () => {
        try {
            const ticketsData = await api.getTickets();
            const inventoryData = await api.getInventory().catch(() => []);

            setTickets(ticketsData);
            setFilteredTickets(ticketsData);
            setInventory(inventoryData);

            // Calculate stats from ticketsData
            const newStats = { total: ticketsData.length, open: 0, closed: 0, pending: 0, onHold: 0 };
            ticketsData.forEach(t => {
                const status = t.status?.toLowerCase();
                if (status === 'open') newStats.open++;
                else if (status === 'resolved' || status === 'closed') newStats.closed++;
                else if (status === 'pending') newStats.pending++;
                else if (status === 'on hold' || status === 'onhold') newStats.onHold++;
            });
            setStats(newStats);

        } catch (e) {
            console.error('Error fetching data:', e);
        }
    };

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('adminUser'));
        setCurrentUser(user);
        fetchData();
        checkPinStatus();
    }, []);

    const checkPinStatus = async () => {
        try {
            const status = await api.getPinStatus();
            setPinStatus(status.isSet);
        } catch (e) {
            console.error('Failed to check PIN status', e);
        }
    };

    useEffect(() => {
        let filtered = tickets;


        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(t => {
                if (statusFilter === 'open') return t.status === 'Open';
                if (statusFilter === 'closed') return t.status === 'Resolved';
                if (statusFilter === 'pending') return t.status === 'Pending';
                if (statusFilter === 'onhold') return t.status === 'On hold';
                return true;
            });
        }

        // Hide Resolved Toggle Logic
        // If "Show Resolved" is OFF, we hide Resolved tickets.
        // NOTE: If user is explicitly on "Solved" tab (statusFilter === 'closed'), we probably should show them anyway?
        // Or strictly obey the toggle? Let's obey toggle but maybe visually warn? 
        // For now: Strict obey, unless statusFilter IS 'closed', then we ignore toggle to avoid empty screen confusion.
        if (!showResolved && statusFilter !== 'closed') {
            filtered = filtered.filter(t => t.status !== 'Resolved');
        }

        // Location Filter
        if (locationFilter !== 'all') {
            filtered = filtered.filter(t => t.office === locationFilter);
        }

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(t =>
                t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.requester_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }


        setFilteredTickets(filtered);
    }, [searchTerm, statusFilter, tickets, showResolved, locationFilter]);

    const handleResolve = async (ticket) => {
        if (ticket.status === 'Resolved') return;

        if (ticket.type === 'HARDWARE_REQUEST') {
            setSelectedTicket(ticket);
            setSelectedItem('');
        } else {
            if (confirm('Mark this support ticket as Resolved?')) {
                const adminUser = JSON.parse(localStorage.getItem('adminUser'));
                await api.updateTicket(ticket.id, {
                    status: 'Resolved',
                    resolved_at: new Date().toISOString(),
                    resolved_by: adminUser?.full_name || 'Admin',
                });
                fetchData();
            }
        }
    };

    const confirmFulfillment = async () => {
        if (!selectedItem) {
            alert('Please select an item to allocate.');
            return;
        }

        try {
            const adminUser = JSON.parse(localStorage.getItem('adminUser'));

            // 1. Update ticket
            await api.updateTicket(selectedTicket.id, {
                status: 'Resolved',
                resolved_at: new Date().toISOString(),
                resolved_by: adminUser?.full_name || 'Admin'
            });

            // 2. Update inventory (decrement quantity)
            const item = inventory.find(i => i.id === selectedItem);
            if (item) {
                await api.updateInventoryItem(selectedItem, { quantity: item.quantity - 1 });
            }

            setSelectedTicket(null);
            setSelectedItem('');
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Failed to fulfill request');
        }
    };

    const calculateDuration = (start, end, reopened) => {
        if (!end) return '-';
        const rangeStart = reopened || start;
        if (!rangeStart) return '-';

        const startTime = new Date(rangeStart + (rangeStart.endsWith('Z') ? '' : 'Z')); // Ensure UTC treatment if not present
        const endTime = new Date(end + (end.endsWith('Z') ? '' : 'Z'));

        const diff = endTime - startTime;
        if (isNaN(diff) || diff < 0) return '-';

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    };

    // PIN Protected Delete
    const initiateDeleteTicket = (ticketId) => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before deleting tickets.\n\nPlease go to Settings > Security (Firewall) and set a PIN first.');
            navigate('/dashboard/settings');
            return;
        }

        const ticket = tickets.find(t => t.id === ticketId);
        setPendingAction({ type: 'DELETE_TICKET', payload: { id: ticketId, name: ticket?.full_name || 'Ticket' } });
        setShowPinModal(true);
    };

    const verifyAndExecute = async () => {
        if (!pinInput) return;

        try {
            const response = await api.verifyPin(pinInput);
            if (response.valid) {
                setShowPinModal(false);
                setPinInput('');

                if (pendingAction?.type === 'DELETE_TICKET') {
                    await executeDeleteTicket(pendingAction.payload.id, pinInput);
                } else if (pendingAction?.type === 'BULK_DELETE') {
                    await executeBulkDelete(pinInput);
                }
                setPendingAction(null);
            }
        } catch (e) {
            alert('❌ Incorrect PIN!');
            setPinInput('');
        }
    };

    const executeDeleteTicket = async (ticketId, securityPin) => {
        try {
            await api.deleteTicket(ticketId, securityPin);
            fetchData();
            setActiveMenu(null);
            setSelectedTickets([]); // Clear selection after delete
            alert('✅ Ticket deleted successfully!');
        } catch (e) {
            alert('Failed to delete ticket');
        }
    };

    // Legacy names for button clicks not yet updated
    const handleDeleteTicket = initiateDeleteTicket;

    // Multi-select handlers
    const toggleSelectTicket = (ticketId) => {
        setSelectedTickets(prev => {
            if (prev.includes(ticketId)) {
                return prev.filter(id => id !== ticketId);
            } else {
                return [...prev, ticketId];
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectedTickets.length === filteredTickets.length) {
            setSelectedTickets([]);
        } else {
            setSelectedTickets(filteredTickets.map(t => t.id));
        }
    };

    const initiateBulkDelete = () => {
        if (selectedTickets.length === 0) return;

        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before deleting tickets.\n\nPlease go to Settings > Security (Firewall) and set a PIN first.');
            navigate('/dashboard/settings');
            return;
        }

        setPendingAction({ type: 'BULK_DELETE', payload: selectedTickets.length });
        setShowPinModal(true);
    };

    const executeBulkDelete = async (securityPin) => {
        try {
            await Promise.all(selectedTickets.map(id => api.deleteTicket(id, securityPin)));
            fetchData();
            setSelectedTickets([]);
            alert(`✅ ${selectedTickets.length} tickets deleted successfully!`);
        } catch (e) {
            alert('Failed to delete some tickets');
        }
    };

    const handleBulkDelete = initiateBulkDelete;

    const exportToCSV = () => {
        const headers = ['Ticket ID', 'Requester', 'Email', 'Description', 'Department', 'Status', 'Agent', 'Host Name', 'IP Address', 'Submitted At', 'Responded At', 'Finished At', 'Duration'];
        const rows = filteredTickets.map(t => [
            t.generated_id,
            t.full_name,
            t.requester_email,
            `"${(t.description || '').replace(/"/g, '""')}"`,
            t.department,
            t.status,
            t.resolved_by || '',
            t.computer_name || '',
            t.ip_address || '',
            new Date(t.created_at).toLocaleString(),
            t.responded_at ? new Date(t.responded_at).toLocaleString() : '-',
            t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '-',
            calculateDuration(t.created_at, t.resolved_at, t.reopened_at)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'tickets_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleStatusChange = async (ticketId, newStatusValue) => {
        // Open modal to get remarks before changing status
        const ticket = tickets.find(t => t.id === ticketId);
        setStatusChangeTicket(ticket);
        setNewStatus(newStatusValue);
        setStatusChangeRemarks('');
    };

    const handleConfirmStatusChange = async () => {
        if (!statusChangeRemarks.trim()) {
            alert('Please enter remarks explaining the status change');
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const adminUser = JSON.parse(localStorage.getItem('adminUser'));
            await api.updateTicket(statusChangeTicket.id, {
                status: newStatus,
                resolved_by: adminUser?.full_name || 'Admin', // Always track agent who updated status

                resolved_at: newStatus === 'Resolved' ? new Date().toISOString() : null,
                responded_at: (statusChangeTicket.status === 'Open' && newStatus !== 'Open') ? new Date().toISOString() : (statusChangeTicket.responded_at || null),
                admin_remarks: statusChangeRemarks
            });

            // Close modal and fetch updated data
            setStatusChangeTicket(null);
            setStatusChangeRemarks('');
            setNewStatus('');
            fetchData();
        } catch (e) {
            alert('Failed to update status');
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }

        // Email Notification logic removed (handled by backend if configured)
    };

    const handleUpdateRemarks = (ticket) => {
        setRemarksTicket({ ...ticket, tempRemarks: ticket.admin_remarks || '' });
    };

    const handleSaveRemarks = async () => {
        if (!remarksTicket) return;
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const adminUser = JSON.parse(localStorage.getItem('adminUser'));
            await api.updateTicket(remarksTicket.id, {
                admin_remarks: remarksTicket.tempRemarks,
                resolved_by: adminUser?.full_name || 'Admin'
            });

            fetchData();
            setRemarksTicket(null);

            // Email Notification logic removed (handled by backend if configured)
        } catch (e) {
            console.error(e);
            alert('Failed to update remarks');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePriorityChange = async (ticketId, newPriority) => {
        try {
            const adminUser = JSON.parse(localStorage.getItem('adminUser'));
            await api.updateTicket(ticketId, {
                priority: newPriority,
                resolved_by: adminUser?.full_name || 'Admin'
            });
            fetchData();
        } catch (e) {
            console.error('Failed to update priority', e);
            alert('Failed to update priority');
        }
    };

    const StatusSelect = ({ ticket }) => {
        const styles = {
            'Open': 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700 border border-cyan-200',
            'Resolved': 'bg-gradient-to-r from-gray-700 to-gray-800 text-white border border-gray-700',
            'Pending': 'bg-gradient-to-r from-amber-400/10 to-yellow-400/10 text-amber-700 border border-amber-200',
            'On hold': 'bg-gradient-to-r from-purple-500/10 to-purple-600/10 text-purple-700 border border-purple-200'
        };

        return (
            <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 hover:shadow-md focus:ring-2 focus:ring-cyan-300 focus:outline-none ${styles[ticket.status]}`}
                onClick={(e) => e.stopPropagation()} // Prevent row click
            >
                <option value="Open" className="bg-[#1e293b] text-slate-200">Open</option>
                <option value="Pending" className="bg-[#1e293b] text-slate-200">Pending</option>
                <option value="On hold" className="bg-[#1e293b] text-slate-200">On hold</option>
                <option value="Resolved" className="bg-[#1e293b] text-slate-200">Resolved</option>
            </select>
        );
    };

    const PrioritySelect = ({ ticket }) => {
        const styles = {
            'Low': 'bg-gray-100 text-gray-700 border border-gray-200',
            'Medium': 'bg-blue-50 text-blue-700 border border-blue-200',
            'High': 'bg-orange-50 text-orange-700 border border-orange-200',
            'Critical': 'bg-red-50 text-red-700 border border-red-200'
        };

        return (
            <select
                value={ticket.priority || 'Medium'}
                onChange={(e) => handlePriorityChange(ticket.id, e.target.value)}
                className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-center w-24 ${styles[ticket.priority] || styles['Medium']}`}
                onClick={(e) => e.stopPropagation()}
            >
                <option value="Low" className="bg-[#1e293b] text-slate-200">Low</option>
                <option value="Medium" className="bg-[#1e293b] text-slate-200">Medium</option>
                <option value="High" className="bg-[#1e293b] text-slate-200">High</option>
                <option value="Critical" className="bg-[#1e293b] text-slate-200">Critical</option>
            </select>
        );
    };

    const getDuration = (createdStr, resolvedStr) => {
        if (!createdStr) return '-';
        const start = new Date(createdStr);
        const end = resolvedStr ? new Date(resolvedStr) : new Date();
        const diffMs = end - start;

        if (diffMs < 0) return '0m';

        const diffMins = Math.floor((diffMs / 60000) % 60);
        const diffHours = Math.floor((diffMs / 3600000) % 24);
        const diffDays = Math.floor(diffMs / 86400000);

        let duration = '';
        if (diffDays > 0) duration += `${diffDays}d `;
        if (diffHours > 0) duration += `${diffHours}h `;
        duration += `${diffMins}m`;

        return duration || '0m';
    };

    const getTimestamp = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] relative">


            {/* Top Navigation with Tabs */}
            <div className="bg-[#1e293b] rounded-t-2xl shadow-sm border border-slate-700/50">
                {/* Title, Tabs and Search Bar - Responsive Stacking */}
                <div className="flex flex-col gap-4 p-4">
                    {/* Row 1: Title & Stats (Hidden Mobile) + Tabs */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-8 w-full md:w-auto">
                            <h2 className="text-lg font-bold text-white hidden md:block">Tickets</h2>

                            {/* Tabs */}
                            <div className="flex flex-wrap justify-start gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`flex-none px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${statusFilter === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    All <span className="hidden sm:inline">tickets</span> <span className="ml-1 text-gray-400">{stats.total}</span>
                                </button>
                                <button
                                    onClick={() => setStatusFilter('open')}
                                    className={`flex-none px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${statusFilter === 'open' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Open <span className="ml-1 text-gray-400">{stats.open}</span>
                                </button>
                                <button
                                    onClick={() => setStatusFilter('pending')}
                                    className={`flex-none px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${statusFilter === 'pending' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Pending <span className="ml-1 text-gray-400">{stats.pending}</span>
                                </button>
                                <button
                                    onClick={() => setStatusFilter('onhold')}
                                    className={`flex-none px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${statusFilter === 'onhold' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Hold <span className="ml-1 text-gray-400">{stats.onHold}</span>
                                </button>
                                <button
                                    onClick={() => setStatusFilter('closed')}
                                    className={`flex-none px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${statusFilter === 'closed' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Solved <span className="ml-1 text-gray-400">{stats.closed}</span>
                                </button>
                            </div>
                        </div>

                        {/* Search Bar - Moved here for desktop layout balance */}
                        <div className="items-center gap-2 w-full md:w-auto hidden md:flex">
                            {/* Desktop Search Position - Standard */}
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="w-full pl-9 pr-4 py-1.5 border border-slate-700 bg-[#0f172a] text-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={exportToCSV}
                                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition shrink-0"
                                title="Export to CSV"
                            >
                                <Download size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Wrappable Filters & Controls */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-slate-800 pt-3 mt-1">

                        {/* Filters Group */}
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {/* Hide Resolved Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer bg-[#0f172a] px-3 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 transition select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={showResolved}
                                        onChange={(e) => setShowResolved(e.target.checked)}
                                    />
                                    <div className={`block w-8 h-5 rounded-full transition-colors ${showResolved ? 'bg-cyan-600' : 'bg-slate-600'}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${showResolved ? 'translate-x-3' : 'translate-x-0'}`}></div>
                                </div>
                                <span className={`text-sm font-medium ${showResolved ? 'text-slate-200' : 'text-slate-500'}`}>
                                    Show Resolved
                                </span>
                            </label>

                            {/* Location Filter Dropdown */}
                            <div className="relative">
                                <select
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                    className="appearance-none bg-[#0f172a] text-slate-200 border border-slate-700/50 rounded-lg pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 hover:border-slate-500 transition cursor-pointer"
                                >
                                    <option value="all">All Locations</option>
                                    {uniqueLocations.map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Search - Visible only on mobile */}
                        <div className="flex items-center gap-2 w-full md:w-auto md:hidden">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search tickets..."
                                    className="w-full pl-9 pr-4 py-2 border border-slate-700 bg-[#0f172a] text-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={exportToCSV}
                                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition shrink-0 bg-[#0f172a] border border-slate-700"
                                title="Export to CSV"
                            >
                                <Download size={20} />
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedTickets.length > 0 && ['Admin', 'Super Admin'].includes(currentUser?.role) && (
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-y border-cyan-200 px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={selectedTickets.length === filteredTickets.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                />
                                <span className="font-semibold text-cyan-900">
                                    {selectedTickets.length} ticket{selectedTickets.length > 1 ? 's' : ''} selected
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg hover:from-rose-600 hover:to-red-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                        >
                            <Trash2 size={16} />
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content with Table */}
            {/* Main Content - Responsive Switch */}
            <div className="flex-1 bg-[#1e293b] rounded-b-2xl shadow-sm border border-slate-700/50 overflow-hidden flex flex-col">
                {/* Table Header Info */}
                <div className="px-2 py-2 border-b border-slate-700/50 flex items-center justify-between bg-[#1e293b]">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-400">{filteredTickets.length} tickets</span>
                    </div>
                </div>

                {/* DESKTOP VIEW: Table (Hidden on Mobile) */}
                <div className="hidden md:block flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse" style={{ minWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.minTableWidth}px` }}>
                        <thead className="bg-[#334155] sticky top-0 z-10 shadow-sm">
                            <tr className="text-slate-300 uppercase tracking-wider font-bold border-b border-slate-600" style={{ fontSize: `${tableConfig.fontSizeHeader}px` }}>
                                {['Admin', 'Super Admin'].includes(currentUser?.role) && (
                                    <th className="py-2 px-2 text-center" style={{ width: tableConfig.colWidths.checkbox }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTickets.length === filteredTickets.length && filteredTickets.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-3.5 h-3.5 text-cyan-600 border-gray-400 rounded focus:ring-cyan-500 cursor-pointer"
                                        />
                                    </th>
                                )}
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.id }}>Ticket ID</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.requester }}>Requester</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.description }}>Description</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.remarks }}>Admin Remarks</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.location }}>Location / Dept</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.device }}>Device Info</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.agent }}>Agent</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.timeline }}>Timeline</th>
                                <th className="py-3 px-2 text-center" style={{ width: tableConfig.colWidths.priority }}>Priority</th>
                                <th className="py-3 px-2 text-center" style={{ width: tableConfig.colWidths.status }}>Status</th>
                                <th className="py-3 px-2" style={{ width: tableConfig.colWidths.actions }}></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 bg-[#1e293b]">
                            {filteredTickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-[#0f172a] transition-colors duration-150 group text-slate-300" style={{ fontSize: `${tableConfig.fontSizeBody}px` }}>
                                    {['Admin', 'Super Admin'].includes(currentUser?.role) && (
                                        <td className="py-2 px-2 text-center border-r border-[#eee8d5]">
                                            <input
                                                type="checkbox"
                                                checked={selectedTickets.includes(ticket.id)}
                                                onChange={() => toggleSelectTicket(ticket.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-3.5 h-3.5 text-cyan-600 border-gray-400 rounded focus:ring-cyan-500 cursor-pointer"
                                            />
                                        </td>
                                    )}
                                    {/* ID */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <span className="font-mono font-bold text-cyan-400 bg-cyan-900/20 px-1.5 py-0.5 rounded border border-cyan-500/30 block w-fit">
                                            {ticket.generated_id}
                                        </span>
                                    </td>
                                    {/* Requester */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white truncate" style={{ maxWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.colWidths.requester - 16}px` }} title={ticket.full_name}>{ticket.full_name || 'Unknown'}</span>
                                            <span className="text-[0.9em] text-slate-400 truncate" style={{ maxWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.colWidths.requester - 16}px` }} title={ticket.requester_email}>{ticket.requester_email}</span>
                                        </div>
                                    </td>
                                    {/* Description */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <div className="flex flex-col gap-1">
                                            {ticket.request_item_type && (
                                                <div className="inline-flex items-center gap-1 bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded-[4px] text-[0.85em] font-bold w-fit border border-purple-500/30">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                    {ticket.request_item_type}
                                                </div>
                                            )}
                                            <div className="line-clamp-2 leading-tight cursor-help hover:text-white" style={{ maxWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.colWidths.description - 16}px` }} title={ticket.description}>
                                                {ticket.description}
                                            </div>
                                        </div>
                                    </td>
                                    {/* Remarks */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <div
                                            onClick={() => handleUpdateRemarks(ticket)}
                                            className="cursor-pointer hover:bg-slate-700/50 p-1.5 rounded border border-transparent hover:border-slate-500 line-clamp-2 leading-tight min-h-[32px]"
                                            style={{ maxWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.colWidths.remarks - 16}px` }}
                                            title={ticket.admin_remarks || 'Click to add'}
                                        >
                                            {ticket.admin_remarks || <span className="text-slate-500 italic text-[0.9em]">Add remarks...</span>}
                                        </div>
                                    </td>
                                    {/* Location / Dept */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-300">{ticket.office || '-'}</span>
                                            <span className="text-[0.9em] text-slate-500">{ticket.department || '-'}</span>
                                        </div>
                                    </td>
                                    {/* Device Info */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-[0.9em] text-amber-400 truncate" style={{ maxWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.colWidths.device - 16}px` }} title={ticket.computer_name || '-'}>{ticket.computer_name || '-'}</span>
                                            <span className="font-mono text-[0.9em] text-slate-500 truncate" style={{ maxWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.colWidths.device - 16}px` }} title={ticket.ip_address || '-'}>{ticket.ip_address || '-'}</span>
                                        </div>
                                    </td>
                                    {/* Agent */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <span className="font-semibold truncate block" style={{ maxWidth: tableConfig.fitToScreen ? '100%' : `${tableConfig.colWidths.agent - 16}px` }} title={ticket.resolved_by}>{ticket.resolved_by || '-'}</span>
                                    </td>
                                    {/* Timeline */}
                                    <td className="py-2 px-2 border-r border-slate-700/50">
                                        <div className="flex items-center justify-between gap-2">
                                            {/* Dates (Left) */}
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5" title="Created At">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></div>
                                                    <span className="font-medium leading-none whitespace-nowrap" style={{ fontSize: '0.9em' }}>
                                                        {new Date(ticket.created).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                {ticket.resolved_at ? (
                                                    <div className="flex items-center gap-1.5" title="Resolved At">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                                                        <span className="font-medium leading-none text-green-400 whitespace-nowrap" style={{ fontSize: '0.9em' }}>
                                                            {new Date(ticket.resolved_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 opacity-50">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0"></div>
                                                        <span className="italic leading-none whitespace-nowrap" style={{ fontSize: '0.9em' }}>In Progress...</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Duration (Right) - Just Time */}
                                            <div className="shrink-0 pl-1 flex flex-col items-end justify-center min-h-[32px]" title={ticket.resolved_at ? "Total Resolution Time" : "Time Open"}>
                                                <span className="text-xs font-bold text-slate-400 font-mono text-right whitespace-nowrap bg-slate-800 px-2 py-1 rounded">
                                                    {getDuration(ticket.created, ticket.resolved_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    {/* Priority */}
                                    <td className="py-2 px-2 border-r border-slate-700/50 text-center">
                                        <PrioritySelect ticket={ticket} />
                                    </td>
                                    {/* Status */}
                                    <td className="py-2 px-2 border-r border-slate-700/50 text-center">
                                        <StatusSelect ticket={ticket} />
                                    </td>
                                    {/* Actions */}
                                    <td className="py-2 px-2 text-center">
                                        {['Admin', 'Super Admin'].includes(currentUser?.role) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTicket(ticket.id);
                                                }}
                                                className="text-[#93a1a1] hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredTickets.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <Clock size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No tickets found</p>
                        </div>
                    )}
                </div>

                {/* MOBILE VIEW: Cards (Visible on Mobile) */}
                <div className="block md:hidden flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    {filteredTickets.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Clock size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No tickets found</p>
                        </div>
                    ) : (
                        filteredTickets.map(ticket => (
                            <div key={ticket.id} className="bg-[#0f172a] rounded-xl border border-slate-700/50 p-4 shadow-sm relative">
                                {/* Header: Status and ID */}
                                <div className="flex justify-between items-start mb-3">
                                    <span className="font-mono font-bold text-cyan-400 bg-cyan-900/20 px-2 py-1 rounded border border-cyan-500/30 text-xs shadow-sm">
                                        {ticket.generated_id}
                                    </span>
                                    <div className="scale-90 origin-right">
                                        <StatusSelect ticket={ticket} />
                                    </div>
                                </div>

                                {/* Body: Requester & Description */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-white text-base leading-tight mb-0.5">{ticket.full_name}</h3>
                                            <p className="text-xs text-slate-400 mb-2 font-mono">{ticket.requester_email}</p>
                                        </div>
                                        <div className="scale-90 origin-top-right">
                                            <PrioritySelect ticket={ticket} />
                                        </div>
                                    </div>

                                    {ticket.request_item_type && (
                                        <div className="inline-flex items-center gap-1 bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded-[4px] text-[10px] uppercase font-bold border border-purple-500/30 mb-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            {ticket.request_item_type}
                                        </div>
                                    )}

                                    <div className="text-sm text-slate-300 leading-snug line-clamp-3 bg-[#1e293b] p-2 rounded border border-slate-700/50">
                                        {ticket.description}
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-x-2 gap-y-3 mb-4 text-xs">
                                    <div className="bg-[#1e293b] p-2 rounded border border-slate-700/50">
                                        <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Location</span>
                                        <span className="text-slate-200 font-medium truncate block">{ticket.office} / {ticket.department}</span>
                                    </div>
                                    <div className="bg-[#1e293b] p-2 rounded border border-slate-700/50">
                                        <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Agent</span>
                                        <span className="text-slate-200 font-medium truncate block">{ticket.resolved_by || '-'}</span>
                                    </div>
                                    <div className="col-span-2 bg-[#1e293b] p-2 rounded border border-slate-700/50">
                                        <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Admin Remarks</span>
                                        <div onClick={() => handleUpdateRemarks(ticket)} className="text-slate-300 cursor-pointer min-h-[1.2em]">
                                            {ticket.admin_remarks ? (
                                                <span className="line-clamp-2">{ticket.admin_remarks}</span>
                                            ) : (
                                                <span className="italic text-slate-500">Tap to add remarks...</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer: Timestamps & Actions */}
                                <div className="flex justify-between items-end pt-3 border-t border-slate-700/50">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <Clock size={12} />
                                            <span>{getTimestamp(ticket.created)}</span>
                                        </div>
                                        {ticket.resolved_at && (
                                            <div className="flex items-center gap-1.5 text-xs text-green-400">
                                                <Check size={12} />
                                                <span>Resolved {getTimestamp(ticket.resolved_at)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {['Admin', 'Super Admin'].includes(currentUser?.role) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTicket(ticket.id);
                                            }}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                                            title="Delete Ticket"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Hardware Fulfillment Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Fulfill Hardware Request</h3>
                        <p className="text-sm text-gray-600 mb-2"><strong>Requested:</strong> {selectedTicket.request_item_type}</p>
                        <p className="text-sm text-gray-600 mb-4"><strong>By:</strong> {selectedTicket.full_name}</p>

                        <label className="block text-sm font-medium text-gray-700 mb-2">Select inventory item to allocate:</label>

                        <button
                            onClick={() => setShowItemSelectionModal(true)}
                            className="w-full p-3 border border-gray-200 rounded-lg mb-4 text-left flex justify-between items-center hover:bg-gray-50 bg-white"
                        >
                            <span className={selectedItem ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                                {selectedItem
                                    ? (() => {
                                        const i = inventory.find(inv => inv.id === selectedItem);
                                        return i ? `${i.item_name} (Qty: ${i.quantity}) - ${i.office_location}` : 'Unknown Item';
                                    })()
                                    : '-- Select Item --'}
                            </span>
                            <Search size={16} className="text-gray-400" />
                        </button>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmFulfillment}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                Allocate & Resolve
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Selection Modal for Fulfillment */}
            {showItemSelectionModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Select Inventory Item</h3>
                            <button onClick={() => setShowItemSelectionModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20} /></button>
                        </div>

                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search inventory..."
                                    className="w-full p-3 pl-10 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    value={itemSearch}
                                    onChange={e => setItemSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {inventory.filter(i =>
                                i.quantity > 0 &&
                                (i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || i.office_location.toLowerCase().includes(itemSearch.toLowerCase()))
                            ).length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No available items found matching your search</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {inventory
                                        .filter(i =>
                                            i.quantity > 0 &&
                                            (i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || i.office_location.toLowerCase().includes(itemSearch.toLowerCase()))
                                        )
                                        .map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedItem(item.id);
                                                    setShowItemSelectionModal(false);
                                                    setItemSearch('');
                                                }}
                                                className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition flex justify-between items-center group"
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-800 group-hover:text-blue-700">{item.item_name}</div>
                                                    <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.office_location}</span>
                                                        <span>{item.category}</span>
                                                    </div>
                                                </div>
                                                <div className={`${item.quantity >= 7 ? 'bg-green-100 text-green-700' :
                                                    item.quantity >= 5 ? 'bg-purple-100 text-purple-700' :
                                                        item.quantity >= 1 ? 'bg-orange-100 text-orange-700' :
                                                            'bg-red-100 text-red-700'
                                                    } px-3 py-1 rounded-full text-xs font-bold`}>
                                                    Qty: {item.quantity}
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                            <button onClick={() => setShowItemSelectionModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Remarks Modal */}
            {remarksTicket && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-gray-100">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-cyan-100 uppercase tracking-wide mb-1">Ticket #{remarksTicket.id}</p>
                                <h2 className="text-xl font-bold text-white">Admin Remarks</h2>
                            </div>
                            <button
                                onClick={() => setRemarksTicket(null)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Enter your remarks or notes for this ticket:
                                </label>
                                <textarea
                                    className="w-full p-4 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none font-mono leading-relaxed"
                                    rows="8"
                                    placeholder="Type your admin remarks here..."
                                    value={remarksTicket.tempRemarks}
                                    onChange={(e) => setRemarksTicket({ ...remarksTicket, tempRemarks: e.target.value })}
                                    autoFocus
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    These remarks are only visible to admins and IT staff.
                                </p>
                            </div>

                            {/* Ticket Info */}
                            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 rounded-xl border border-cyan-100 mb-6">
                                <p className="text-xs font-semibold text-gray-600 mb-2">TICKET DETAILS</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-600">Requester:</span>
                                        <span className="ml-2 font-medium text-gray-900">{remarksTicket.full_name}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Status:</span>
                                        <span className="ml-2 font-medium text-gray-900">{remarksTicket.status}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-600">Description:</span>
                                        <span className="ml-2 font-medium text-gray-900">{remarksTicket.description}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setRemarksTicket(null)}
                                    className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveRemarks}
                                    disabled={isSubmitting}
                                    className={`px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-700 transition shadow-md hover:shadow-lg ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Remarks'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Change Remarks Modal */}
            {statusChangeTicket && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-gray-100">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-cyan-100 uppercase tracking-wide mb-1">Ticket #{statusChangeTicket.id}</p>
                                <h2 className="text-xl font-bold text-white">Status Change Confirmation</h2>
                            </div>
                            <button
                                onClick={() => setStatusChangeTicket(null)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
                            {/* Status Change Info */}
                            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 rounded-xl border border-cyan-100 mb-6">
                                <p className="text-xs font-semibold text-gray-600 mb-3">STATUS CHANGE</p>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-gray-700 border">{statusChangeTicket.status}</span>
                                    <span className="text-cyan-600">→</span>
                                    <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium">{newStatus}</span>
                                </div>
                            </div>

                            {/* Ticket Details */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                                <p className="text-xs font-semibold text-gray-600 mb-2">TICKET DETAILS</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-600">Requester:</span>
                                        <span className="ml-2 font-medium text-gray-900">{statusChangeTicket.full_name}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Email:</span>
                                        <span className="ml-2 font-medium text-gray-900">{statusChangeTicket.requester_email}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-600">Description:</span>
                                        <span className="ml-2 font-medium text-gray-900">{statusChangeTicket.description}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Remarks Input */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    Status Change Remarks <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-600 mb-3">
                                    Please explain the reason for this status change. This will be sent to the requester and all admins.
                                </p>
                                <textarea
                                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                                    rows="5"
                                    placeholder="Enter your remarks here... (e.g., Issue resolved: Replaced faulty RAM module)"
                                    value={statusChangeRemarks}
                                    onChange={(e) => setStatusChangeRemarks(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t flex gap-3 justify-end">
                            <button
                                onClick={() => setStatusChangeTicket(null)}
                                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmStatusChange}
                                disabled={isSubmitting}
                                className={`px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:from-cyan-600 hover:to-blue-700 shadow-md transition flex items-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        Confirm Status Change
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Verification Modal */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                <Shield size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Security Check</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {pendingAction?.type === 'DELETE_TICKET'
                                    ? `⚠️ Delete ticket for "${pendingAction.payload.name}"? Enter PIN to confirm.`
                                    : pendingAction?.type === 'BULK_DELETE'
                                        ? `⚠️ Delete ${pendingAction.payload} selected tickets? Enter PIN to confirm.`
                                        : 'Enter your admin PIN to proceed.'}
                            </p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); verifyAndExecute(); }}>
                            <input
                                type="password"
                                className="w-full text-center text-2xl tracking-[0.5em] font-bold border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all mb-6"
                                placeholder="••••"
                                maxLength={6}
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                autoFocus
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowPinModal(false); setPinInput(''); setPendingAction(null); }}
                                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition"
                                >
                                    Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardTickets;
