import { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { ArrowLeft, Send, CheckCircle, User, Briefcase, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendEmailNotification } from '../lib/emailService';

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
    attachment_path: ''
  });
  const [offices, setOffices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    /* Fetch config for branding */
    pb.collection('settings').getFullList()
      .then(records => {
        const settingsMap = {};
        records.forEach(record => { if (record.key && record.value) settingsMap[record.key] = record.value; });
        setConfig(settingsMap);
      })
      .catch(console.error);

    /* Fetch dynamic offices */
    pb.collection('offices').getFullList()
      .then(records => {
        setOffices(records.length ? records : [{ id: 1, name: 'Main Office' }]);
      })
      .catch(() => setOffices([{ id: 1, name: 'Main Office' }]));

    /* Fetch dynamic departments */
    pb.collection('departments').getFullList()
      .then(records => {
        setDepartments(records.length ? records : [{ id: 1, name: 'General' }]);
      })
      .catch(() => setDepartments([{ id: 1, name: 'General' }]));
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file.");
      return;
    }

    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // Resize to ensure it fits in Firestore (1MB limit)

            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG 70% quality
          };
          img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
      });

      setFormData(prev => ({ ...prev, attachment_path: base64 }));
    } catch (err) {
      console.error("Image Processing Error", err);
      alert("Failed to process image.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const generated_id = `#IT-${Math.floor(1000 + Math.random() * 9000)}`; // Simple ID gen for now

      const payload = {
        ...formData,
        generated_id,
        status: 'Open',
        created_at: new Date().toISOString()
      };

      await pb.collection('tickets').create(payload);

      setSubmitted(generated_id);

      // Send Email Notification
      await sendEmailNotification({
        service_id: config.emailjs_service_id,
        template_id: config.emailjs_template_id,
        public_key: config.emailjs_public_key
      }, {
        ticket_id: generated_id,
        to_name: "Admin",
        from_name: formData.full_name,
        message: `${formData.type} [${formData.priority}]: ${formData.description}`,
        reply_to: formData.requester_email,
        office: formData.office,
        ip: formData.ip_address
      });
    } catch (err) {
      console.error(err);
      alert("Failed to submit ticket.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Ticket Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your reference ID is <span className="font-mono font-bold text-blue-600">{submitted}</span>.
            <br />We have sent a confirmation email.
          </p>
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-4 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${config.background_url})` }}>
      {/* Overlay for better contrast */}
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="max-w-5xl mx-auto bg-white/95 rounded-2xl shadow-2xl overflow-hidden border border-white/50 relative z-10">
        <div className="p-4 bg-blue-600 text-white flex items-center gap-4">
          <button onClick={() => navigate('/')} className="hover:bg-blue-500 p-2 rounded-full transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">New Support Request</h1>
            <p className="text-blue-100 text-sm">Please provide detailed information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Section 1: User Details */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <User size={20} className="text-blue-600" /> Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input required type="text" className="w-full p-2.5 border rounded-lg text-sm" placeholder="John Doe"
                  value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input required type="email" className="w-full p-2.5 border rounded-lg text-sm" placeholder="john@company.com"
                  value={formData.requester_email} onChange={e => setFormData({ ...formData, requester_email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Computer Name</label>
                <input type="text" className="w-full p-2.5 border rounded-lg text-sm" placeholder="DESKTOP-ABC1234"
                  value={formData.computer_name} onChange={e => setFormData({ ...formData, computer_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                <input type="text" className="w-full p-2.5 border rounded-lg text-sm" placeholder="192.168.1.100"
                  value={formData.ip_address} onChange={e => setFormData({ ...formData, ip_address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="w-full p-2.5 border rounded-lg bg-white text-sm" required
                  value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                  <option value="">-- Select Department --</option>
                  {departments
                    .sort((a, b) => {
                      const order = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'BIM', 'HBS', 'EVG', 'HR', 'IT'];
                      const indexA = order.indexOf(a.name);
                      const indexB = order.indexOf(b.name);
                      // If found in list, use index. If not, put at end (999).
                      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    })
                    .map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  {departments.length === 0 && <option disabled>Loading...</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Office Location</label>
                <select className="w-full p-2.5 border rounded-lg bg-white text-sm" required
                  value={formData.office} onChange={e => setFormData({ ...formData, office: e.target.value })}>
                  <option value="">-- Select Office --</option>
                  {offices
                    .sort((a, b) => {
                      const order = ['HYD', 'AMD', 'VA', 'MD', 'WIN', 'El Salvador'];
                      const indexA = order.indexOf(a.name);
                      const indexB = order.indexOf(b.name);
                      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    })
                    .map(off => (
                      <option key={off.id} value={off.name}>{off.name}</option>
                    ))}
                  {offices.length === 0 && <option disabled>Loading...</option>}
                </select>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 2: Request Details */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Briefcase size={20} className="text-blue-600" /> Request Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Request Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => setFormData({ ...formData, type: 'SUPPORT_ISSUE' })}
                    className={`p-3 rounded-xl border text-center transition text-sm ${formData.type === 'SUPPORT_ISSUE' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-blue-300'}`}>
                    🛠 Support Issue
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, type: 'HARDWARE_REQUEST' })}
                    className={`p-3 rounded-xl border text-center transition text-sm ${formData.type === 'HARDWARE_REQUEST' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-blue-300'}`}>
                    💻 Hardware Request
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority Level</label>
                <select className="w-full p-2.5 border rounded-lg bg-white text-sm"
                  value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                  <option value="Low">🟢 Low - Minor Issue</option>
                  <option value="Medium">🟡 Medium - Standard</option>
                  <option value="High">🟠 High - Urgent</option>
                  <option value="Critical">🔴 Critical - Blocker</option>
                </select>
                {formData.type === 'HARDWARE_REQUEST' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Needed</label>
                    <input required type="text" placeholder="e.g. Mouse" className="w-full p-2.5 border rounded-lg text-sm"
                      value={formData.request_item_type} onChange={e => setFormData({ ...formData, request_item_type: e.target.value })} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Reason</label>
                <textarea required rows={3} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                  placeholder="Please describe the issue in detail..."
                  value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              {/* Attachment Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (Optional)</label>
                <div className={`border-2 border-dashed rounded-xl p-4 text-center transition h-[90px] flex items-center justify-center ${formData.attachment_path ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-400'}`}>
                  {formData.attachment_path ? (
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <CheckCircle size={18} />
                      <span className="font-semibold text-xs">Attached</span>
                      <button type="button" onClick={() => setFormData({ ...formData, attachment_path: '' })}
                        className="bg-white rounded-full p-1 shadow hover:bg-gray-50 text-red-500">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-full h-full flex items-center justify-center">
                      {uploading ? (
                        <span className="text-gray-500 animate-pulse text-xs">Uploading...</span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="mx-auto text-gray-400 mb-1" size={20} />
                          <span className="text-gray-500 text-xs">Click to upload</span>
                        </div>
                      )}
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  )}
                </div>

              </div>
            </div>

          </div>

          <button type="submit" disabled={loading || uploading}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition shadow-lg flex items-center justify-center gap-2">
            {loading ? 'Submitting...' : <><Send size={18} /> Submit Ticket</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TicketSubmission;
