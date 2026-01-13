import { useState, useEffect } from 'react';
import api from '../lib/api';
import { ArrowLeft, Send, CheckCircle, User, Briefcase, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FloatingSplitLayout from '../components/FloatingSplitLayout';

const TicketSubmission = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ background_url: '' });
  const [formData, setFormData] = useState({
    requester_email: '',
    full_name: '',
    computer_name: '',
    ip_address: '',
    department: '',
    priority: 'Low',
    office: '',
    type: 'SUPPORT_ISSUE',
    description: '',
    request_item_type: '',
    attachment: null
  });
  const [offices, setOffices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [showItemSelectionModal, setShowItemSelectionModal] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.getSettings().then(setConfig).catch(console.error);
    api.getOffices().then(records => setOffices(records.length ? records : [{ id: 1, name: 'Main Office' }])).catch(() => setOffices([{ id: 1, name: 'Main Office' }]));
    api.getDepartments().then(records => setDepartments(records.length ? records : [{ id: 1, name: 'General' }])).catch(() => setDepartments([{ id: 1, name: 'General' }]));
    api.getInventory().then(items => setInventoryItems(items)).catch(console.error);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file.");
      return;
    }
    setFormData(prev => ({ ...prev, attachment: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'attachment' && formData[key]) fd.append('attachment', formData[key]);
        else if (formData[key]) fd.append(key, formData[key]);
      });
      const response = await api.createTicket(fd);
      setSubmitted(response.generated_id);
    } catch (err) {
      console.error(err);
      alert("Failed to submit ticket.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <FloatingSplitLayout>
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_15px_-3px_rgba(74,222,128,0.4)]">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Ticket Submitted!</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Your reference ID is <span className="font-mono font-bold text-cyan-400 text-lg mx-1">{submitted}</span>
            <br />We have sent a confirmation email.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl font-bold transition-all shadow-lg hover:shadow-cyan-500/25"
          >
            Back to Home
          </button>
        </div>
      </FloatingSplitLayout>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-[#0f172a] font-sans text-slate-200">
      <div className="fixed inset-0 bg-[#0f172a] z-0">
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-cyan-900/10 to-transparent opacity-30"></div>
      </div>

      <div className="max-w-5xl mx-auto bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50 relative z-10">
        <div className="bg-gradient-to-r from-cyan-900/40 to-slate-900/40 p-8 border-b border-slate-700/50 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="hover:bg-slate-700/50 p-2 rounded-full transition text-slate-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">New Support Request</h1>
            <p className="text-cyan-400/80 text-sm">Please provide detailed information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <User size={20} className="text-cyan-400" /> Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'John Doe', required: true },
                { label: 'Email Address', key: 'requester_email', type: 'email', placeholder: 'john@company.com', required: true },
                { label: 'Computer Name', key: 'computer_name', type: 'text', placeholder: 'DESKTOP-ABC1234' },
                { label: 'IP Address', key: 'ip_address', type: 'text', placeholder: '192.168.1.100' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{field.label}</label>
                  <input
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                    value={formData[field.key]}
                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                <select className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-slate-200 focus:border-cyan-500 focus:outline-none transition-colors text-sm" required
                  value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                  <option value="">-- Select Department --</option>
                  {departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Office Location</label>
                <select className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-slate-200 focus:border-cyan-500 focus:outline-none transition-colors text-sm" required
                  value={formData.office} onChange={e => setFormData({ ...formData, office: e.target.value })}>
                  <option value="">-- Select Office --</option>
                  {offices.map(off => <option key={off.id} value={off.name}>{off.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-700/50" />

          <div>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Briefcase size={20} className="text-cyan-400" /> Request Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Request Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { type: 'SUPPORT_ISSUE', label: '🛠 Support Issue' },
                    { type: 'HARDWARE_REQUEST', label: '💻 Hardware Request', action: () => setShowItemSelectionModal(true) }
                  ].map(opt => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, type: opt.type });
                        if (opt.action) opt.action();
                      }}
                      className={`p-4 rounded-xl border text-center transition text-sm font-semibold  ${formData.type === opt.type
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 ring-1 ring-cyan-500/50'
                        : 'bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority Level</label>
                <select className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-slate-200 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                  value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                  <option value="Low">🟢 Low - Minor Issue</option>
                  <option value="Medium">🟡 Medium - Standard</option>
                  <option value="High">🟠 High - Urgent</option>
                  <option value="Critical">🔴 Critical - Blocker</option>
                </select>
                {formData.type === 'HARDWARE_REQUEST' && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Item Needed</label>
                    <button
                      type="button"
                      onClick={() => setShowItemSelectionModal(true)}
                      className={`w-full p-3 border rounded-xl text-sm text-left flex justify-between items-center ${formData.request_item_type
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                    >
                      {formData.request_item_type || "Click to Select Item"}
                      <Briefcase size={16} className="text-slate-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description / Reason</label>
                <textarea required rows={3}
                  className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none resize-none text-sm leading-relaxed"
                  placeholder="Please describe the issue in detail..."
                  value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachment (Optional)</label>
                <div className={`border-2 border-dashed rounded-xl p-4 text-center transition h-[106px] flex items-center justify-center ${formData.attachment
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50'
                  }`}>
                  {formData.attachment ? (
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <CheckCircle size={18} />
                      <span className="font-semibold text-xs">Attached</span>
                      <button type="button" onClick={() => setFormData({ ...formData, attachment: null })}
                        className="bg-slate-800 rounded-full p-1 hover:bg-slate-700 text-red-400 transition">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-full h-full flex items-center justify-center">
                      <div className="flex flex-col items-center">
                        <Upload className="mx-auto text-slate-500 mb-1" size={20} />
                        <span className="text-slate-500 text-xs">Click to upload</span>
                      </div>
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || uploading}
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-2xl font-bold transition shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 text-lg disabled:opacity-50"
          >
            {loading ? 'Submitting...' : <><Send size={20} /> Submit Ticket</>}
          </button>
        </form>
      </div>

      {/* Item Selection Modal */}
      {showItemSelectionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh] border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Select Hardware Item</h3>
              <button onClick={() => setShowItemSelectionModal(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><X size={20} /></button>
            </div>

            {/* Search Input Removed */}

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {/* Simplified Item Logic for dark mode without search */}
              {(() => {
                const selectedOffice = formData.office;
                const itemsToShow = selectedOffice
                  ? inventoryItems.filter(item => item.office_location === selectedOffice)
                  : inventoryItems;

                /* Logic from Step 914, just updating JSX */
                const uniqueItemsMap = new Map();
                itemsToShow.forEach(item => {
                  const normName = item.item_name.trim();
                  if (!uniqueItemsMap.has(normName)) {
                    uniqueItemsMap.set(normName, { ...item, item_name: normName, quantity: 0 });
                  }
                  uniqueItemsMap.get(normName).quantity += (Number(item.quantity) || 0);
                });

                const filteredItems = Array.from(uniqueItemsMap.values());

                const sortOrder = ['Mouse', 'Headphones', 'Keyboard', 'Webcam', 'RAM', 'Monitor', 'CPU'];
                filteredItems.sort((a, b) => {
                  const idxA = sortOrder.findIndex(k => a.item_name.includes(k));
                  const idxB = sortOrder.findIndex(k => b.item_name.includes(k));
                  return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                });

                if (filteredItems.length === 0) return <div className="text-center py-8 text-slate-500">No items found.</div>;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredItems.map(item => {
                      const qty = item.quantity;
                      let borderClass = '';

                      // Color coding based on quantity (Dark theme adapted)
                      if (qty >= 7) {
                        // GREEN - Good stock (7+)
                        borderClass = 'border-2 border-green-500 bg-green-500/10 hover:bg-green-500/20 shadow-sm hover:shadow-green-500/20';
                      }
                      else if (qty >= 5) {
                        // PURPLE - Medium stock (5-6)
                        borderClass = 'border-2 border-purple-500 bg-purple-500/10 hover:bg-purple-500/20 shadow-sm hover:shadow-purple-500/20';
                      }
                      else if (qty >= 1) {
                        // ORANGE - Low stock (1-4)
                        borderClass = 'border-2 border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 shadow-sm hover:shadow-orange-500/20';
                      }
                      else {
                        // RED - Out of stock (0)
                        borderClass = 'border-2 border-red-500 bg-red-500/10 hover:bg-red-500/20';
                      }

                      return (
                        <button key={item.item_name} type="button"
                          onClick={() => { setFormData({ ...formData, request_item_type: item.item_name }); setShowItemSelectionModal(false); }}
                          className={`p-3 rounded-lg transition-all duration-200 text-sm font-medium text-slate-200 hover:text-white ${borderClass}`}
                        >
                          {item.item_name}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 text-right">
              <button onClick={() => setShowItemSelectionModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketSubmission;
