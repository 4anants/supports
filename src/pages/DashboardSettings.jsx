import { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { Save, Upload, Trash2, Plus, Layout, Users, MapPin, Mail, Layers, Shield } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { sendEmailNotification } from '../lib/emailService';

const DashboardSettings = () => {
    const { config, refreshConfig } = useConfig();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Data States
    const [formData, setFormData] = useState({
        company_name: '', logo_url: '', background_url: '',
        emailjs_service_id: '', emailjs_template_id: '', emailjs_public_key: '',
        allowed_ips: '', smtp_from_name: '' // Added smtp_from_name to initial state if needed
    });
    const [settingsIds, setSettingsIds] = useState({});

    const [offices, setOffices] = useState([]);
    const [newOffice, setNewOffice] = useState('');

    const [departments, setDepartments] = useState([]);
    const [newDepartment, setNewDepartment] = useState('');

    // Test email state
    const [testEmail, setTestEmail] = useState('');
    const [testEmailLoading, setTestEmailLoading] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');

    const [admins, setAdmins] = useState([]);
    const [newAdmin, setNewAdmin] = useState({ username: '', password: '', full_name: '', role: 'IT', email: '' });
    const [editingAdmin, setEditingAdmin] = useState(null);

    useEffect(() => {
        // Fetch Settings
        pb.collection('settings').getFullList().then(records => {
            const settingsMap = {};
            const idsMap = {};
            records.forEach(record => {
                settingsMap[record.key] = record.value;
                idsMap[record.key] = record.id;
            });
            setFormData(prev => ({ ...prev, ...settingsMap }));
            setSettingsIds(idsMap);
        });
        fetchOffices();
        fetchDepartments();
        fetchAdmins();
    }, []);

    const fetchOffices = () => pb.collection('offices').getFullList().then(setOffices);
    const fetchDepartments = () => pb.collection('departments').getFullList().then(setDepartments);
    const fetchAdmins = () => pb.collection('users').getFullList().then(setAdmins);

    // --- HANDLERS ---
    const handleFileUpload = async (e, field) => {
        alert("File upload is not supported in this version. Please enter a direct image URL.");
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const promises = Object.entries(formData).map(async ([key, value]) => {
                if (settingsIds[key]) {
                    return pb.collection('settings').update(settingsIds[key], { value });
                } else {
                    const record = await pb.collection('settings').create({ key, value });
                    setSettingsIds(prev => ({ ...prev, [key]: record.id }));
                    return record;
                }
            });
            await Promise.all(promises);
            await refreshConfig();
            alert('Settings Saved!');
        } catch (e) {
            console.error(e);
            alert('Error saving settings');
        } finally {
            setLoading(false);
        }
    };

    // Offices
    const addOffice = async () => {
        if (!newOffice) return;
        try {
            await pb.collection('offices').create({ name: newOffice });
            setNewOffice('');
            fetchOffices();
        } catch (e) {
            console.error(e);
            alert(`Error adding office`);
        }
    };
    const removeOffice = async (id) => {
        if (!confirm('Delete?')) return;
        try {
            await pb.collection('offices').delete(id);
            fetchOffices();
        } catch (e) { alert('Failed to delete office'); }
    };

    // Locations Reset Logic
    const resetOffices = async () => {
        if (!confirm('This will DELETE all current offices and reset them to the standard list (HYD, AMD, VA, etc.). Continue?')) return;
        setLoading(true);
        try {
            // 1. Delete all existing
            const records = await pb.collection('offices').getFullList();
            await Promise.all(records.map(r => pb.collection('offices').delete(r.id)));

            // 2. Add new list
            const standardList = ['HYD', 'AMD', 'VA', 'MD', 'WIN', 'El Salvador'];
            await Promise.all(standardList.map(name => pb.collection('offices').create({ name })));

            fetchOffices();
            alert('Offices reset to standard list!');
        } catch (err) {
            console.error(err);
            alert('Error resetting offices');
        } finally {
            setLoading(false);
        }
    };

    // Departments
    const addDepartment = async () => {
        if (!newDepartment) return;
        try {
            await pb.collection('departments').create({ name: newDepartment });
            setNewDepartment('');
            fetchDepartments();
        }
        catch (e) { alert('Failed to add department'); }
    };
    const removeDepartment = async (id) => {
        if (!confirm('Delete?')) return;
        try {
            await pb.collection('departments').delete(id);
            fetchDepartments();
        } catch (e) { alert('Failed to delete department'); }
    };

    // Admins
    const addAdmin = async () => {
        console.log("Add Admin Clicked", newAdmin);
        if (!newAdmin.email) {
            alert('Email field is empty!');
            return;
        }
        if (!newAdmin.username || !newAdmin.password) {
            alert('Please fill in required fields (Username, Email, Password)');
            return;
        }

        try {
            const data = {
                username: newAdmin.username,
                email: newAdmin.email,
                emailVisibility: true,
                password: newAdmin.password,
                passwordConfirm: newAdmin.password,
                full_name: newAdmin.full_name,
                role: newAdmin.role
            };

            await pb.collection('users').create(data);

            setNewAdmin({ username: '', password: '', full_name: '', role: 'IT', email: '' });
            fetchAdmins();
            alert('User account created successfully!');
        } catch (e) {
            console.error("Add Admin Error:", e);
            alert(`Error creating user: ${e.message}`);
        }
    };

    const startEditAdmin = (admin) => {
        setEditingAdmin({ ...admin, password: '' });
    };

    const updateAdmin = async () => {
        if (!editingAdmin.username) return;
        try {
            const data = {
                username: editingAdmin.username,
                email: editingAdmin.email,
                full_name: editingAdmin.full_name,
                role: editingAdmin.role
            };
            if (editingAdmin.password) {
                data.password = editingAdmin.password;
                data.passwordConfirm = editingAdmin.password;
            }

            await pb.collection('users').update(editingAdmin.id, data);
            setEditingAdmin(null);
            fetchAdmins();
            alert('Admin details updated.');
        } catch (e) {
            alert('Failed to update admin');
            console.error(e);
        }
    };

    const removeAdmin = async (id) => {
        if (!confirm('Remove this user? This will delete the account.')) return;
        try { await pb.collection('users').delete(id); fetchAdmins(); }
        catch (e) { alert('Failed to remove admin'); }
    };

    const cancelEditAdmin = () => {
        setEditingAdmin(null);
    };

    // Test email function
    // Test email function
    const handleTestEmail = async () => {
        if (!testEmail) { alert("Please enter a test email address"); return; }
        setTestEmailLoading(true);
        setTestEmailResult(null);
        try {
            // Prepare config object
            const config = {
                service_id: formData.emailjs_service_id,
                template_id: formData.emailjs_template_id,
                public_key: formData.emailjs_public_key
            };

            const result = await sendEmailNotification(config, {
                to_email: testEmail,
                to_name: "Admin",
                message: "This is a test email from your IT Support Dashboard via EmailJS.",
                ticket_id: "TEST-123"
            });

            if (result.success) {
                setTestEmailResult({ success: true, message: "Email Sent Successfully! Check your inbox." });
            } else {
                setTestEmailResult({ success: false, message: "Failed: " + (result.error.text || "Unknown Error") });
            }
        } catch (e) {
            setTestEmailResult({ success: false, message: e.message });
        } finally {
            setTestEmailLoading(false);
        }
    };
    // --- TABS CONFIG ---
    const tabs = [
        { id: 'general', label: 'General & Branding', icon: Layout },
        { id: 'offices', label: 'Offices', icon: MapPin },
        { id: 'departments', label: 'Departments', icon: Layers },
        { id: 'admins', label: 'Admins', icon: Users },
        { id: 'email', label: 'Email Config (EmailJS)', icon: Mail },
        { id: 'security', label: 'Security (Firewall)', icon: Shield },
    ];

    return (
        <div className="w-full h-[calc(100vh-6rem)] flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">System Settings</h2>

            <div className="flex flex-col flex-1 overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100">
                {/* Top Tabs */}
                <div className="w-full bg-white border-b border-gray-200 flex overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 overflow-y-auto bg-gray-50/30">
                    {activeTab === 'general' && (
                        <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                <input className="w-full p-2 border rounded-lg" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                                    <div className="flex gap-2">
                                        <input className="w-full p-2 border rounded-lg bg-white text-xs"
                                            value={formData.logo_url}
                                            placeholder="Paste direct link (https://.../logo.png)"
                                            onChange={e => setFormData({ ...formData, logo_url: e.target.value })}
                                        />
                                        <label className="cursor-pointer bg-blue-100 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-200 transition">
                                            <Upload size={16} />
                                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'logo_url')} />
                                        </label>
                                    </div>
                                    {uploadStatus && <div className="text-xs mt-1 text-blue-600 font-medium">{uploadStatus}</div>}
                                    {formData.logo_url && (
                                        <img
                                            src={formData.logo_url}
                                            className="h-12 mt-2 object-contain border p-1 rounded bg-white"
                                            alt="Preview"
                                            onError={(e) => { e.target.style.display = 'none'; alert("Error: Logo link is broken. Make sure it's a direct image link."); }}
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
                                    <div className="flex gap-2">
                                        <input className="w-full p-2 border rounded-lg bg-white text-xs"
                                            value={formData.background_url}
                                            placeholder="Paste direct link (https://.../bg.jpg)"
                                            onChange={e => setFormData({ ...formData, background_url: e.target.value })}
                                        />
                                        <label className="cursor-pointer bg-blue-100 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-200 transition">
                                            <Upload size={16} />
                                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'background_url')} />
                                        </label>
                                    </div>
                                    {formData.background_url && (
                                        <img
                                            src={formData.background_url}
                                            className="h-24 mt-2 object-cover rounded-lg w-full border"
                                            alt="Preview"
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Invalid+Link'; e.target.alt = 'Failed to load'; }}
                                        />
                                    )}
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2">
                                <Save size={18} /> Save Changes
                            </button>
                        </form>
                    )}

                    {activeTab === 'offices' && (
                        <div className="max-w-4xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-700">Office Locations</h3>
                                <button
                                    onClick={resetOffices}
                                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                >
                                    Reset to Standard List
                                </button>
                            </div>
                            <div className="flex gap-4 mb-6">
                                <input className="flex-1 p-3 border rounded-xl shadow-sm" value={newOffice} onChange={e => setNewOffice(e.target.value)} placeholder="Enter New Office Name..." />
                                <button onClick={addOffice} className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-green-700 shadow-md transform hover:-translate-y-0.5 transition"><Plus size={18} /> Add Office</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {offices
                                    .sort((a, b) => {
                                        const order = ['HYD', 'AMD', 'VA', 'MD', 'WIN', 'El Salvador'];
                                        const indexA = order.indexOf(a.name);
                                        const indexB = order.indexOf(b.name);
                                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                                    })
                                    .map(office => (
                                        <div key={office.id} className="p-4 border rounded-xl flex justify-between items-center bg-white shadow-sm hover:shadow-md transition">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><MapPin size={20} /></div>
                                                <span className="font-semibold text-gray-700">{office.name}</span>
                                            </div>
                                            <button onClick={() => removeOffice(office.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash2 size={18} /></button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'departments' && (
                        <div className="max-w-4xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-700">Departments</h3>
                                <button
                                    onClick={async () => {
                                        if (!confirm('This will DELETE all current departments and reset them to the standard list. Continue?')) return;
                                        setLoading(true);
                                        try {
                                            // 1. Delete all existing
                                            const records = await pb.collection('departments').getFullList();
                                            await Promise.all(records.map(r => pb.collection('departments').delete(r.id)));

                                            // 2. Add new list in order
                                            const standardList = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'BIM', 'HBS', 'EVG', 'HR', 'IT'];
                                            await Promise.all(standardList.map((name, index) =>
                                                pb.collection('departments').create({ name, order: index + 1 })
                                            ));

                                            fetchDepartments();
                                            alert('Departments reset to standard list!');
                                        } catch (err) {
                                            console.error(err);
                                            alert('Error resetting departments');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                >
                                    Reset to Standard List
                                </button>
                            </div>
                            <div className="flex gap-4 mb-6">
                                <input className="flex-1 p-3 border rounded-xl shadow-sm" placeholder="Enter New Department Name..." value={newDepartment} onChange={e => setNewDepartment(e.target.value)} />
                                <button onClick={addDepartment} className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-green-700 shadow-md transform hover:-translate-y-0.5 transition"><Plus size={18} /> Add Department</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {departments
                                    .sort((a, b) => {
                                        const order = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'BIM', 'HBS', 'EVG', 'HR', 'IT'];
                                        const indexA = order.indexOf(a.name);
                                        const indexB = order.indexOf(b.name);
                                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                                    })
                                    .map(dept => (
                                        <div key={dept.id} className="p-4 border rounded-xl flex justify-between items-center bg-white shadow-sm hover:shadow-md transition">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Layers size={20} /></div>
                                                <span className="font-semibold text-gray-700">{dept.name}</span>
                                            </div>
                                            <button onClick={() => removeDepartment(dept.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash2 size={18} /></button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'admins' && (
                        <div className="max-w-5xl">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">Admin Accounts</h3>

                            {/* Add/Edit Form */}
                            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-200 shadow-sm mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                    <input
                                        className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="Full Name"
                                        value={editingAdmin ? editingAdmin.full_name : newAdmin.full_name}
                                        onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, full_name: e.target.value }) : setNewAdmin({ ...newAdmin, full_name: e.target.value })}
                                    />
                                    <input
                                        className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="Email"
                                        type="email"
                                        value={editingAdmin ? (editingAdmin.email || '') : newAdmin.email}
                                        onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, email: e.target.value }) : setNewAdmin({ ...newAdmin, email: e.target.value })}
                                    />
                                    <input
                                        className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="Username"
                                        value={editingAdmin ? editingAdmin.username : newAdmin.username}
                                        onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, username: e.target.value }) : setNewAdmin({ ...newAdmin, username: e.target.value })}
                                    />
                                    <input
                                        className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder={editingAdmin ? "New Password (optional)" : "Password"}
                                        type="password"
                                        value={editingAdmin ? editingAdmin.password : newAdmin.password}
                                        onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, password: e.target.value }) : setNewAdmin({ ...newAdmin, password: e.target.value })}
                                    />
                                    <select
                                        className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-medium"
                                        value={editingAdmin ? editingAdmin.role : newAdmin.role}
                                        onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, role: e.target.value }) : setNewAdmin({ ...newAdmin, role: e.target.value })}
                                    >
                                        <option value="Admin">Admin</option>
                                        <option value="IT">IT Support</option>
                                    </select>
                                    {editingAdmin ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={updateAdmin}
                                                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-2.5 rounded-lg hover:from-cyan-600 hover:to-blue-700 flex items-center justify-center gap-2 font-semibold shadow-sm"
                                            >
                                                <Save size={18} /> Update
                                            </button>
                                            <button
                                                onClick={() => setEditingAdmin(null)}
                                                className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={addAdmin}
                                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2.5 rounded-lg hover:from-green-600 hover:to-emerald-700 flex items-center justify-center gap-2 font-semibold shadow-sm"
                                        >
                                            <Plus size={18} /> Add User
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Admin Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {admins.map(admin => (
                                    <div key={admin.id} className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                        {/* Gradient Accent */}
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600"></div>

                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                                                    {admin.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-bold block text-gray-900">{admin.full_name}</span>
                                                    <span className="text-xs text-gray-500 font-mono">@{admin.username}</span>
                                                    {admin.email && (
                                                        <span className="text-xs text-gray-500 block mt-0.5">📧 {admin.email}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Role Badge */}
                                        <div className="mb-3">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${admin.role === 'Admin'
                                                ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200'
                                                : 'bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 border border-cyan-200'
                                                }`}>
                                                {admin.role || 'IT Support'}
                                            </span>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => startEditAdmin(admin)}
                                                className="flex-1 text-sm px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700 border border-cyan-200 rounded-lg hover:from-cyan-500/20 hover:to-blue-500/20 transition-all font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => removeAdmin(admin.id)}
                                                className="px-3 py-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-200"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'email' && (
                        <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">Email Settings (SMTP)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name (Display Name)</label>
                                    <input
                                        value={formData.smtp_from_name}
                                        onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="e.g., Company IT Support"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">This name will appear in the "From" field of sent emails.</p>
                                </div>
                                <p className="text-sm text-gray-500 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    Client-side email sending requires <strong>EmailJS</strong>.
                                    <br />1. Create a free account at <a href="https://www.emailjs.com" target="_blank" className="text-blue-600 font-bold hover:underline">emailjs.com</a>.
                                    <br />2. Create a generic Email Service (e.g. Gmail).
                                    <br />3. Create an Email Template with variables like <code>{`{{to_name}}`}</code>, <code>{`{{message}}`}</code>, <code>{`{{ticket_id}}`}</code>.
                                </p>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Service ID</label>
                                    <input
                                        value={formData.emailjs_service_id || ''}
                                        onChange={(e) => setFormData({ ...formData, emailjs_service_id: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="e.g., service_xyz123"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Template ID</label>
                                    <input
                                        value={formData.emailjs_template_id || ''}
                                        onChange={(e) => setFormData({ ...formData, emailjs_template_id: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="e.g., template_abc456"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
                                    <input
                                        type="text"
                                        value={formData.emailjs_public_key || ''}
                                        onChange={(e) => setFormData({ ...formData, emailjs_public_key: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="e.g., 9A8b7C6d5E4f"
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold hover:from-cyan-600 hover:to-blue-700 transition flex items-center gap-2 shadow-md">
                                <Save size={18} /> Save Email Settings
                            </button>

                            {/* Test Email Section */}
                            <div className="mt-8 pt-8 border-t border-gray-200">
                                <h4 className="text-md font-bold text-gray-700 mb-4">📧 Test Email Configuration</h4>
                                <p className="text-sm text-gray-600 mb-4">
                                    Send a test email to verify your SMTP settings are working correctly. Make sure to save your settings first!
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        placeholder="Enter email address to send test to..."
                                    />
                                    <button
                                        type="button"
                                        onClick={handleTestEmail}
                                        disabled={testEmailLoading}
                                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-700 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {testEmailLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Mail size={18} />
                                                Send Test Email
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Test Result */}
                                {testEmailResult && (
                                    <div className={`mt-4 p-4 rounded-xl border-2 ${testEmailResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <p className={`text-sm font-medium ${testEmailResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                            {testEmailResult.success ? '✅ ' : '❌ '}
                                            {testEmailResult.message}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </form>
                    )}
                    {activeTab === 'security' && (
                        <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">Security Settings & Firewall</h3>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Shield className="text-amber-600 mt-1" size={24} />
                                    <div>
                                        <h4 className="font-bold text-amber-800">Firewall Active</h4>
                                        <p className="text-amber-700 text-sm mt-1">
                                            The application is protected by a rate-limiting firewall.
                                            Global Limit: <strong>300 req/15min</strong>.
                                            Login Limit: <strong>10 attempts/15min</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Allowed IPs (Whitelist)</label>
                                <textarea
                                    value={formData.allowed_ips || ''}
                                    onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
                                    className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm"
                                    placeholder="e.g. 192.168.1.1, 10.0.0.5, ::1"
                                    rows="4"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Comma-separated list of IP addresses that will <strong>bypass</strong> the rate limiter.
                                    Useful for office static IPs or internal networks.
                                </p>
                            </div>

                            <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-rose-800 transition flex items-center gap-2 shadow-md">
                                <Save size={18} /> Save Security Settings
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardSettings;
