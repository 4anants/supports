import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useConfig } from '../contexts/ConfigContext';
import { Search, ArrowLeft, Loader2, AlertCircle, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import FloatingSplitLayout from '../components/FloatingSplitLayout';

const TicketTracker = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { config } = useConfig();
    const navigate = useNavigate();

    // State for Search Mode
    const [searchInput, setSearchInput] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');

    // State for Details Mode
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(!!id);
    const [error, setError] = useState('');
    const [isReopening, setIsReopening] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [reopenSubmitting, setReopenSubmitting] = useState(false);

    // Fetch Ticket if ID is present
    useEffect(() => {
        const fetchTicket = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const cleanId = id.replace(/^#/, '');
                let record;
                if (api.trackTicket) {
                    record = await api.trackTicket(cleanId);
                } else {
                    const response = await api.get(`/tickets/${cleanId}`);
                    record = response.data;
                }

                if (record) {
                    setTicket(record);
                } else {
                    setError('Ticket not found. Please check the ID.');
                }
            } catch (err) {
                console.error("Tracker Error:", err);
                setError(`Error: ${err.message || 'Failed to load ticket'}`);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchTicket();
        } else {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (ticket && (ticket.status === 'Resolved' || ticket.status === 'Closed') && searchParams.get('reopen') === 'true') {
            setIsReopening(true);
        }
    }, [ticket, searchParams]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;

        setSearchLoading(true);
        setSearchError('');

        try {
            const response = await api.get(`/tickets?search=${searchInput}`);
            if (response.data && response.data.length > 0) {
                const found = response.data.find(t => t.visual_id === searchInput) || response.data[0];
                navigate(`/track/${found.visual_id || found.generated_id || found.id}`);
            } else {
                setSearchError('Ticket not found. Please check the ID and try again.');
            }
        } catch (err) {
            console.error(err);
            setSearchError('Unable to search. Please try again later.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleReopen = async () => {
        if (!reopenReason.trim()) return;
        setReopenSubmitting(true);
        try {
            let updatedTicket;
            if (api.reopenTicket) {
                updatedTicket = await api.reopenTicket(ticket.generated_id, reopenReason);
            } else {
                const res = await api.post(`/tickets/${ticket.id}/reopen`, { reason: reopenReason });
                updatedTicket = res.data;
            }
            setTicket(updatedTicket);
            setIsReopening(false);
            setReopenReason('');
            alert('Ticket Reopened Successfully');
        } catch (err) {
            alert(err.message);
        } finally {
            setReopenSubmitting(false);
        }
    };

    // RENDER: Loading
    if (loading) return (
        <div className="h-screen bg-[#111827] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-cyan-400" size={48} />
                <p className="text-slate-400 font-medium">Loading ticket details...</p>
            </div>
        </div>
    );

    // RENDER: Search Mode (Dark Floating Split Card)
    if (!id) {
        return (
            <FloatingSplitLayout>
                <div className="max-w-md w-full mx-auto">
                    <Link to="/" className="inline-flex items-center text-slate-500 hover:text-cyan-400 font-medium mb-10 transition-colors group text-sm">
                        <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </Link>

                    <div className="mb-8">
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
                            Track Your <span className="text-cyan-400">Request</span>
                        </h1>
                        <p className="text-slate-400 text-base">
                            Enter your Ticket ID to check the status.
                        </p>
                    </div>

                    <form onSubmit={handleSearch} className="space-y-8">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Ticket ID</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                    placeholder="IT-XXXX"
                                    className="block w-full py-4 bg-transparent border-b-2 border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors text-xl font-mono tracking-wide"
                                    autoFocus
                                />
                                <Search className="absolute right-0 top-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" size={24} />
                            </div>
                        </div>

                        {searchError && (
                            <div className="flex items-center gap-3 p-4 bg-red-900/20 text-red-200 rounded-xl border border-red-900/50">
                                <AlertCircle size={20} className="shrink-0 text-red-400" />
                                <span className="font-medium text-sm">{searchError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={searchLoading || !searchInput.trim()}
                            className="w-full flex items-center justify-center py-4 px-6 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-2xl font-bold text-lg shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {searchLoading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-3 h-6 w-6" />
                                    Searching...
                                </>
                            ) : (
                                'Track Ticket'
                            )}
                        </button>
                    </form>
                </div>
            </FloatingSplitLayout>
        );
    }

    // RENDER: Ticket Details Mode (Dark Centered Card)
    if (!ticket) return null;

    return (
        <div className="min-h-screen w-full bg-[#0f172a] py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center font-sans text-slate-200">
            <div className="fixed inset-0 bg-[#0f172a] z-0">
                <div className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay"
                    style={{ backgroundImage: config.background_url ? `url(${config.background_url})` : 'none' }}>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-cyan-900/10 to-transparent opacity-30"></div>
            </div>

            <div className="relative z-10 w-full max-w-3xl">
                <Link to="/track-ticket" className="inline-flex items-center text-slate-500 hover:text-cyan-400 font-medium mb-8 transition-colors">
                    <ArrowLeft size={20} className="mr-2" /> Back to Search
                </Link>

                {error ? (
                    <div className="bg-[#1e293b] p-8 rounded-2xl shadow-xl text-center border border-slate-700">
                        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                        <h2 className="text-xl font-bold text-white mb-2">Error</h2>
                        <p className="text-slate-400">{error}</p>
                    </div>
                ) : (
                    <div className="bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-cyan-900/40 to-slate-900/40 p-8 border-b border-slate-700/50">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-4">
                                    {config.logo_url && (
                                        <img
                                            src={config.logo_url}
                                            alt="Logo"
                                            className="h-16 w-auto object-contain opacity-90 hidden sm:block"
                                        />
                                    )}
                                    <div>
                                        <p className="text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1">Ticket ID</p>
                                        <h1 className="text-3xl font-bold text-white tracking-tight">{ticket.visual_id || ticket.generated_id}</h1>
                                    </div>
                                </div>
                                <div className={`px-4 py-2 rounded-full font-bold text-sm shadow-sm ${ticket.status === 'Resolved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                    ticket.status === 'Open' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                        'bg-slate-700 text-slate-300'
                                    }`}>
                                    {ticket.status}
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-8">
                            {/* Reopen Section */}
                            {(ticket.status === 'Resolved' || ticket.status === 'Closed') && !isReopening && (
                                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 text-center">
                                    <p className="text-slate-400 mb-4">Issue not resolved?</p>
                                    <button
                                        onClick={() => setIsReopening(true)}
                                        className="inline-flex items-center px-6 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm font-bold text-slate-200 rounded-full transition-colors"
                                    >
                                        <RefreshCw size={16} className="mr-2" /> Reopen Ticket
                                    </button>
                                </div>
                            )}

                            {isReopening && (
                                <div className="bg-cyan-900/10 p-6 rounded-xl border border-cyan-500/20 animate-in fade-in">
                                    <h3 className="font-bold text-cyan-400 mb-2">Reopen Ticket</h3>
                                    <p className="text-sm text-slate-400 mb-4">Please exist reason for reopening.</p>
                                    <textarea
                                        value={reopenReason}
                                        onChange={(e) => setReopenReason(e.target.value)}
                                        className="w-full p-4 bg-[#0f172a] border border-slate-700 rounded-xl focus:border-cyan-500 outline-none text-sm min-h-[100px] mb-4 text-slate-200 placeholder-slate-600"
                                        placeholder="Explain why the issue persists..."
                                    />
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setIsReopening(false)}
                                            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-300"
                                            disabled={reopenSubmitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleReopen}
                                            disabled={!reopenReason.trim() || reopenSubmitting}
                                            className="px-6 py-2 text-sm font-bold text-slate-900 bg-cyan-500 hover:bg-cyan-400 rounded-full shadow-sm disabled:opacity-50"
                                        >
                                            {reopenSubmitting ? 'Submitting...' : 'Confirm Reopen'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-3 space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 text-slate-300 leading-relaxed">
                                        {ticket.description}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Requester</label>
                                    <p className="font-semibold text-white">{ticket.full_name}</p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Support Agent</label>
                                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                                        <CheckCircle size={16} className="text-slate-500" />
                                        <span>{ticket.resolved_by || 'Pending...'}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Created</label>
                                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                                        <Clock size={16} className="text-slate-500" />
                                        {new Date(ticket.created).toLocaleString()}
                                    </div>
                                </div>

                                {/* Admin Remarks */}
                                {ticket.admin_remarks && (
                                    <div className="md:col-span-3">
                                        <div className="bg-yellow-900/10 p-4 rounded-xl border border-yellow-700/30 flex gap-4">
                                            <AlertCircle className="shrink-0 text-yellow-500" size={24} />
                                            <div>
                                                <h4 className="font-bold text-yellow-500 text-sm uppercase mb-1">Support Team Remarks</h4>
                                                <p className="text-yellow-200/80">{ticket.admin_remarks}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TicketTracker;
