import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useConfig } from '../contexts/ConfigContext';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

const TicketTracker = () => {
    const { id } = useParams();
    const { config } = useConfig();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchTicket = async () => {
            try {
                // Handle both generated ID (IT-1234) and direct doc ID if needed
                // The URL id will likely be IT-1234 (clean) or hash #IT-1234 (dirty)
                const cleanId = id.replace(/^#/, '');

                // Try to find by generated_id
                const record = await api.trackTicket(cleanId);
                if (record) {
                    setTicket(record);
                } else {
                    setError('Ticket not found. Please check the ID.');
                }
            } catch (err) {
                console.error("Tracker Error:", err);
                setError(`Error: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchTicket();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading ticket details...</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
            <div className="w-full max-w-lg">
                <Link to="/" className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition">
                    <ArrowLeft size={18} className="mr-2" /> Back to Home
                </Link>

                {error ? (
                    <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
                        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
                        <p className="text-gray-600">{error}</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-blue-100 font-medium text-sm mb-1 uppercase tracking-wide">Ticket Status</p>
                                    <h1 className="text-3xl font-bold">{ticket.generated_id}</h1>
                                    <div className="flex items-center gap-2 mt-2 text-blue-100/90 text-sm font-medium bg-white/10 px-3 py-1 rounded w-fit">
                                        <span>Agent:</span>
                                        <span className="text-white">{ticket.resolved_by || 'IT Support'}</span>
                                    </div>
                                </div>
                                <div className={`px-4 py-2 rounded-full font-bold text-sm shadow-sm ${ticket.status === 'Resolved' ? 'bg-green-500 text-white' :
                                    ticket.status === 'Open' ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-200 text-gray-800'
                                    }`}>
                                    {ticket.status}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="space-y-4">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Requester</label>
                                        <p className="font-medium text-gray-800 text-sm">{ticket.full_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Submitted</label>
                                        <p className="font-medium text-gray-800 text-sm">{ticket.created ? new Date(ticket.created).toLocaleString() : '-'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                                        <p className="mt-1 text-gray-700 text-sm leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {ticket.description}
                                        </p>
                                    </div>

                                    {/* Attachment Link */}
                                    {ticket.attachment_path && (
                                        <div className="md:col-span-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Attachment</label>
                                            <a
                                                href={`${api.baseUrl.replace('/api', '')}${ticket.attachment_path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-2 rounded-md transition hover:bg-blue-100"
                                            >
                                                View Attached File
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Updates / Timeline */}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <RefreshCw size={20} className="text-blue-500" /> Activity & Remarks
                                    </h3>

                                    <div className="space-y-4">
                                        {/* Status Update */}
                                        {ticket.resolved_at && (
                                            <div className="flex gap-4">
                                                <div className="mt-1"><CheckCircle className="text-green-500" size={20} /></div>
                                                <div>
                                                    <p className="font-semibold text-gray-800">Resolved</p>
                                                    <p className="text-sm text-gray-500">by {ticket.resolved_by}</p>
                                                    <p className="text-xs text-gray-400 mt-1">{new Date(ticket.resolved_at).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Admin Remarks */}
                                        {ticket.admin_remarks && (
                                            <div className="flex gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                                <div className="mt-1"><AlertCircle className="text-blue-600" size={20} /></div>
                                                <div>
                                                    <p className="font-semibold text-blue-900">Latest Update from Support</p>
                                                    <p className="text-gray-700 mt-1">{ticket.admin_remarks}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Created */}
                                        <div className="flex gap-4 opacity-70">
                                            <div className="mt-1"><Clock className="text-gray-400" size={20} /></div>
                                            <div>
                                                <p className="font-semibold text-gray-700">Ticket Created</p>
                                                <p className="text-xs text-gray-400 mt-1">{new Date(ticket.created).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TicketTracker;
