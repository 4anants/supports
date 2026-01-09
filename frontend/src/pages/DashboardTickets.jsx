import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Search, Filter, MoreVertical, ExternalLink, Check, Clock, Download, Trash2, X, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../contexts/ConfigContext';


const DashboardTickets = () => {
    const { config } = useConfig();
    const navigate = useNavigate();

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

    // Multi-selection state
    const [selectedTickets, setSelectedTickets] = useState([]);

    const [activeMenu, setActiveMenu] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    // Fulfillment Modal State
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [viewTicket, setViewTicket] = useState(null);
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
        console.log('Raw tickets:', tickets.length, 'Status filter:', statusFilter);

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

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(t =>
                t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.requester_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        console.log('Filtered tickets:', filtered.length);
        setFilteredTickets(filtered);
    }, [searchTerm, statusFilter, tickets]);

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
                <option value="Open" className="bg-white text-gray-800">Open</option>
                <option value="Pending" className="bg-white text-gray-800">Pending</option>
                <option value="On hold" className="bg-white text-gray-800">On hold</option>
                <option value="Resolved" className="bg-white text-gray-800">Resolved</option>
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
                <option value="Low" className="bg-white text-gray-700">Low</option>
                <option value="Medium" className="bg-white text-gray-700">Medium</option>
                <option value="High" className="bg-white text-gray-700">High</option>
                <option value="Critical" className="bg-white text-gray-700">Critical</option>
            </select>
        );
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
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            {/* Top Navigation with Tabs */}
            <div className="bg-white rounded-t-2xl shadow-sm border border-gray-100">
                {/* Title, Tabs and Search Bar on same line */}
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-8">
                        <h2 className="text-lg font-bold text-gray-800">Tickets</h2>

                        {/* Tabs */}
                        <div className="flex gap-1">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${statusFilter === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                All tickets <span className="ml-1 text-gray-400">{stats.total}</span>
                            </button>
                            <button
                                onClick={() => setStatusFilter('open')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${statusFilter === 'open' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                Open <span className="ml-1 text-gray-400">{stats.open}</span>
                            </button>
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${statusFilter === 'pending' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                Pending <span className="ml-1 text-gray-400">{stats.pending}</span>
                            </button>
                            <button
                                onClick={() => setStatusFilter('onhold')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${statusFilter === 'onhold' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                On hold <span className="ml-1 text-gray-400">{stats.onHold}</span>
                            </button>
                            <button
                                onClick={() => setStatusFilter('closed')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${statusFilter === 'closed' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                Solved <span className="ml-1 text-gray-400">{stats.closed}</span>
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search in all tickets..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={exportToCSV}
                        className="ml-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        title="Export to CSV"
                    >
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedTickets.length > 0 && currentUser?.role === 'Admin' && (
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
            <div className="flex-1 bg-white rounded-b-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                {/* Table Header Info */}
                <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-gray-400" />
                        <span className="text-sm text-gray-600">{filteredTickets.length} tickets</span>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                            <tr className="text-left text-sm text-gray-600 uppercase tracking-wide font-semibold border-b-2 border-gray-200">
                                {currentUser?.role === 'Admin' && (
                                    <th className="py-4 px-4 font-semibold w-12">
                                        <input
                                            type="checkbox"
                                            checked={selectedTickets.length === filteredTickets.length && filteredTickets.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                        />
                                    </th>
                                )}
                                <th className="py-4 px-4 font-semibold min-w-[120px]">Ticket ID</th>
                                <th className="py-4 px-4 font-semibold min-w-[180px]">Requester</th>
                                <th className="py-4 px-4 font-semibold min-w-[200px]">Description</th>
                                <th className="py-4 px-4 font-semibold min-w-[180px]">Admin Remarks</th>
                                <th className="py-4 px-4 font-semibold min-w-[130px]">Location / Dept</th>
                                <th className="py-4 px-4 font-semibold min-w-[130px]">Device Info</th>
                                <th className="py-4 px-4 font-semibold min-w-[100px]">Agent</th>
                                <th className="py-4 px-4 font-semibold min-w-[130px]">Timeline</th>
                                <th className="py-4 px-4 font-semibold min-w-[120px]">Priority</th>
                                <th className="py-4 px-4 font-semibold min-w-[120px]">Status</th>
                                <th className="py-4 px-4 font-semibold w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-gray-50 transition">
                                    {currentUser?.role === 'Admin' && (
                                        <td className="py-4 px-4 border-r border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={selectedTickets.includes(ticket.id)}
                                                onChange={() => toggleSelectTicket(ticket.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                            />
                                        </td>
                                    )}
                                    <td className="py-4 px-4 whitespace-nowrap border-r border-gray-100">
                                        <span className="font-mono text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                            {ticket.generated_id}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 border-r border-gray-100">
                                        <div>
                                            <div className="font-medium text-gray-900 text-sm">{ticket.full_name || 'Unknown'}</div>
                                            <div className="text-xs text-gray-500">{ticket.requester_email}</div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 border-r border-gray-100">
                                        <div className="flex flex-col gap-2">
                                            {ticket.request_item_type && (
                                                <div className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-semibold w-fit border border-purple-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                    Hard: {ticket.request_item_type}
                                                </div>
                                            )}
                                            <div
                                                className="flex items-start gap-2 cursor-pointer group"
                                                onClick={() => setViewTicket(ticket)}
                                                title="Click to view full description"
                                            >
                                                <span className="text-red-500 text-sm">•</span>
                                                <div className="text-sm text-gray-900 group-hover:text-blue-600 truncate max-w-[200px]">
                                                    {ticket.description}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 border-r border-gray-100">
                                        <div
                                            onClick={() => handleUpdateRemarks(ticket)}
                                            className="text-xs text-gray-600 cursor-pointer hover:bg-gray-100 p-1 rounded border border-transparent hover:border-gray-200 min-h-[24px] max-w-[200px] truncate"
                                            title="Click to edit remarks"
                                        >
                                            {ticket.admin_remarks || <span className="text-gray-400 italic">Add remarks...</span>}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 border-r border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-900">{ticket.office || '-'}</span>
                                            <span className="text-xs text-gray-500">{ticket.department || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 border-r border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-gray-900">{ticket.computer_name || '-'}</span>
                                            <span className="text-xs text-gray-500">{ticket.ip_address || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-100">
                                        <div className="font-medium">{ticket.resolved_by || '-'}</div>
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-100">
                                        {ticket.resolved_at ? (
                                            <div className="space-y-0.5">
                                                <div className="text-xs text-gray-900 font-medium flex items-center gap-1">
                                                    <Clock size={12} className="text-blue-500" />
                                                    {calculateDuration(ticket.created, ticket.resolved_at, ticket.reopened_at)}
                                                </div>
                                                <div className="text-[10px] text-gray-500">
                                                    Sub: {new Date(ticket.created).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} | Res: {ticket.responded_at ? new Date(ticket.responded_at).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-gray-400">
                                                Sub: {new Date(ticket.created).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 px-4 border-r border-gray-100">
                                        <PrioritySelect ticket={ticket} />
                                    </td>
                                    <td className="py-4 px-4 border-r border-gray-100">
                                        <StatusSelect ticket={ticket} />
                                    </td>
                                    <td className="py-4 px-4">
                                        {currentUser?.role === 'Admin' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTicket(ticket.id);
                                                }}
                                                className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                                                title="Delete Ticket"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredTickets.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <Clock size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No tickets found</p>
                        </div>
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
            {/* View Ticket Detail Modal */}
            {viewTicket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setViewTicket(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1"
                        >
                            <X size={20} />
                        </button>

                        <div className="mb-4 pr-8">
                            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Ticket Subject</span>
                            <h3 className="text-lg font-medium text-gray-900 mt-1">Full Description</h3>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-700 text-sm whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto font-mono">
                            {viewTicket.description}
                        </div>

                        {viewTicket.attachment_path && (
                            <div className="mt-4">
                                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Attachment</span>
                                <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 max-w-[200px]">
                                    <img
                                        src={`${api.baseUrl.replace('/api', '')}${viewTicket.attachment_path}`}
                                        alt="Attachment"
                                        className="w-full h-auto cursor-pointer"
                                        onClick={() => window.open(`${api.baseUrl.replace('/api', '')}${viewTicket.attachment_path}`, '_blank')}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setViewTicket(null)}
                                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition shadow-sm"
                            >
                                Close
                            </button>
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
