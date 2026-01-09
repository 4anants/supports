import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Save, Upload, Trash2, Plus, Layout, Users, MapPin, Mail, Layers, Shield, Database } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';


const DashboardSettings = () => {
    const { config, refreshConfig } = useConfig();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Data States
    const [formData, setFormData] = useState({
        company_name: '', logo_url: '', background_url: '',
        smtp_service: '', smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '',
        smtp_secure: 'false', smtp_from_address: '', smtp_from_name: '',
        allowed_ips: '',
        backup_frequency: 'NEVER', backup_path: '',
        onedrive_enabled: 'false', onedrive_client_id: '', onedrive_client_secret: '', onedrive_refresh_token: '', onedrive_folder: ''
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
    const [newAdmin, setNewAdmin] = useState({ username: '', password: '', name: '', role: 'IT', email: '' });
    const [editingAdmin, setEditingAdmin] = useState(null);

    // Backup State
    const [backups, setBackups] = useState([]);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupStatus, setBackupStatus] = useState('');

    // Firewall State
    const [recentBlocks, setRecentBlocks] = useState([]);

    // PIN Security State
    const [pinStatus, setPinStatus] = useState(false); // isSet: boolean
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pendingAction, setPendingAction] = useState(null); // { type: 'SAVE' | 'BACKUP', payload: any }
    const [newPin, setNewPin] = useState('');

    useEffect(() => {
        // Fetch ALL Settings (authenticated)
        api.getAllSettings().then(settingsMap => {
            setFormData(prev => ({ ...prev, ...settingsMap }));
        });
        api.get('/settings/pin-status').then(res => setPinStatus(res.isSet));

        fetchOffices();
        fetchDepartments();
        fetchAdmins();
        fetchBackups();
    }, []);

    useEffect(() => {
        if (activeTab === 'security') {
            api.get('/settings/firewall').then(res => {
                setRecentBlocks(res.recent_blocks || []);
            }).catch(e => console.error("Firewall stats error", e));
        }
    }, [activeTab]);

    const fetchOffices = () => api.getOffices().then(setOffices);
    const fetchDepartments = () => api.getDepartments().then(setDepartments);
    const fetchAdmins = () => api.getUsers().then(setAdmins);
    const fetchBackups = () => api.getBackups().then(res => setBackups(res || []));

    // --- PIN HANDLERS ---
    const initiateSave = (e) => {
        e.preventDefault();

        // MANDATORY PIN CHECK: Admin must set PIN before saving
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before saving settings.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security'); // Redirect to security tab
            return;
        }

        // PIN is set, ask for verification
        setPendingAction({ type: 'SAVE' });
        setShowPinModal(true);
    };

    const initiateBackup = () => {
        // MANDATORY PIN CHECK: Admin must set PIN before triggering backup
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before triggering backups.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security'); // Redirect to security tab
            return;
        }

        // PIN is set, ask for verification
        setPendingAction({ type: 'BACKUP' });
        setShowPinModal(true);
    };

    const confirmPinAction = async () => {
        if (!pinInput) return;

        const pin = pinInput;
        setShowPinModal(false);
        setPinInput('');

        if (pendingAction?.type === 'SAVE') {
            await executeSave(pin);
        } else if (pendingAction?.type === 'BACKUP') {
            await executeBackup(pin);
        } else if (pendingAction?.type === 'ADD_OFFICE') {
            await executeAddOffice(pendingAction.payload, pin);
        } else if (pendingAction?.type === 'DELETE_OFFICE') {
            await executeRemoveOffice(pendingAction.payload, pin);
        } else if (pendingAction?.type === 'ADD_DEPARTMENT') {
            await executeAddDepartment(pendingAction.payload, pin);
        } else if (pendingAction?.type === 'DELETE_DEPARTMENT') {
            await executeRemoveDepartment(pendingAction.payload, pin);
        } else if (pendingAction?.type === 'ADD_ADMIN') {
            await executeAddAdmin(pendingAction.payload, pin);
        } else if (pendingAction?.type === 'UPDATE_ADMIN') {
            await executeUpdateAdmin(pendingAction.payload, pin);
        } else if (pendingAction?.type === 'DELETE_ADMIN') {
            await executeRemoveAdmin(pendingAction.payload, pin);
        } else if (pendingAction?.type === 'RESET_OFFICES') {
            await executeResetOffices(pin);
        } else if (pendingAction?.type === 'RESET_DEPARTMENTS') {
            await executeResetDepartments(pin);
        } else if (pendingAction?.type === 'RESET_DATA') {
            await executeResetData(pin);
        } else if (pendingAction?.type === 'RESET_SITE') {
            await executeResetSite(pin);
        }
        setPendingAction(null);
    };

    const executeSave = async (securityPin = null) => {
        setLoading(true);
        try {
            // Helper to add header if pin exists
            const options = securityPin ? { headers: { 'x-security-pin': securityPin } } : {};

            // We need to update api.updateSetting to accept options or do manual calls
            // Manually calling axios/fetch for settings save to allow headers
            const promises = Object.entries(formData).map(async ([key, value]) => {
                // Using the base API client to include auth headers + custom PIN header
                return api.updateSetting(key, value, securityPin);
            });
            await Promise.all(promises);
            await refreshConfig();
            alert('Settings Saved!');
        } catch (e) {
            console.error(e);
            const msg = e.response?.data?.error || 'Error saving settings';
            alert(msg === 'Invalid Security PIN' ? '❌ Incorrect PIN!' : msg);
        } finally {
            setLoading(false);
        }
    };

    const executeBackup = async (securityPin = null) => {
        setBackupLoading(true);
        setBackupStatus('Starting backup...');
        try {
            // const options = securityPin ? { headers: { 'x-security-pin': securityPin } } : {};
            const res = await api.triggerBackup(securityPin);

            if (res.success) {
                setBackupStatus('✅ Success!');
                fetchBackups();
            } else {
                setBackupStatus('❌ Failed: ' + res.error);
            }
        } catch (e) {
            const msg = e.response?.data?.error || e.message;
            if (msg === 'Invalid Security PIN') {
                setBackupStatus('❌ Incorrect PIN');
                alert('❌ Incorrect PIN');
            } else {
                setBackupStatus('❌ Error: ' + msg);
            }
        } finally {
            setBackupLoading(false);
            if (!securityPin || pinStatus) // Keep status visible if successful
                setTimeout(() => setBackupStatus(''), 5000);
        }
    };

    const handleSetPin = async () => {
        if (!newPin) return alert('Enter a PIN');
        try {
            await api.post('/settings/pin/set', { pin: newPin });
            setPinStatus(true);
            setNewPin('');
            alert('Security PIN Set! You will now need this PIN to save changes.');
        } catch (e) { alert(e.message); }
    };

    const handleResetPin = async () => {
        // User Requirement: "reset pin not ask for old pin"
        if (!confirm('Remove Security PIN? Settings will no longer be protected.')) return;
        try {
            await api.post('/settings/pin/reset', {});
            setPinStatus(false);
            alert('Security PIN Removed.');
        } catch (e) { alert(e.message); }
    };

    // --- LEGACY HANDLERS REMAPPED ---
    const triggerBackup = initiateBackup;
    const handleSave = initiateSave; // Replaces the old handleSave

    // Offices - WITH PIN PROTECTION
    const initiateAddOffice = () => {
        if (!newOffice) return;

        // MANDATORY PIN CHECK
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before adding offices.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }

        // PIN is set, ask for verification
        setPendingAction({ type: 'ADD_OFFICE', payload: newOffice });
        setShowPinModal(true);
    };

    const executeAddOffice = async (officeName, securityPin) => {
        try {
            await api.createOffice(officeName, securityPin);
            setNewOffice('');
            fetchOffices();
            alert('✅ Office added successfully!');
        } catch (e) {
            console.error('Add office error:', e);
            alert('❌ Failed to add office: ' + (e.message || 'Unknown error'));
        }
    };

    const initiateRemoveOffice = (id, officeName) => {
        // MANDATORY PIN CHECK (no browser confirm - we'll confirm via PIN modal)
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before deleting offices.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }

        // PIN is set, ask for verification (the PIN modal will serve as confirmation)
        setPendingAction({ type: 'DELETE_OFFICE', payload: { id, name: officeName } });
        setShowPinModal(true);
    };

    const executeRemoveOffice = async (payload, securityPin) => {
        const id = typeof payload === 'object' ? payload.id : payload;
        try {
            await api.deleteOffice(id, securityPin);
            fetchOffices();
            alert('✅ Office deleted successfully!');
        } catch (e) {
            console.error('Delete office error:', e);
            alert('❌ Failed to delete office: ' + (e.message || 'Unknown error'));
        }
    };

    const initiateResetOffices = () => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before resetting offices.\n\nPlease go to Settings > Security (Firewall) and set a PIN first.');
            setActiveTab('security');
            return;
        }
        setPendingAction({ type: 'RESET_OFFICES' });
        setShowPinModal(true);
    };

    const executeResetOffices = async (securityPin) => {
        setLoading(true);
        try {
            const records = await api.getOffices();
            await Promise.all(records.map(r => api.deleteOffice(r.id, securityPin)));

            const standardList = ['HYD', 'AMD', 'VA', 'MD', 'WIN', 'El Salvador'];
            await Promise.all(standardList.map(name => api.createOffice(name, securityPin)));

            fetchOffices();
            alert('✅ Offices reset to standard list!');
        } catch (e) {
            console.error(e);
            alert('❌ Error resetting offices: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- DANGER: SITE RESETS ---
    const initiateResetData = () => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required! Set a PIN first.');
            setActiveTab('security');
            return;
        }
        setPendingAction({ type: 'RESET_DATA' });
        setShowPinModal(true);
    };

    const executeResetData = async (pin) => {
        setLoading(true);
        try {
            await api.resetData(pin);
            alert("✅ Ticketing Data & Stock Quantities have been reset.");
        } catch (e) {
            console.error(e);
            alert("Error: " + (e.message || e.response?.data?.error));
        } finally { setLoading(false); }
    };

    const initiateResetSite = () => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required! Set a PIN first.');
            setActiveTab('security');
            return;
        }
        // Double confirmation for Site Reset
        if (!confirm("⚠️ FACTORY RESET WARNING ⚠️\n\nThis will wipe EVERYTHING:\n- All Tickets\n- All Inventory Items & Logs\n- All Settings\n- Offices & Departments\n\nOnly User Accounts and PIN will remain.\n\nAre you ABSOLUTELY SURE?")) return;

        setPendingAction({ type: 'RESET_SITE' });
        setShowPinModal(true);
    };

    const executeResetSite = async (pin) => {
        setLoading(true);
        try {
            await api.resetSite(pin);
            alert("✅ System has been reset to factory defaults.");
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error: " + (e.message || e.response?.data?.error));
        } finally { setLoading(false); }
    };

    // File Upload Handler
    const handleFileUpload = async (e, fieldName) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadStatus('Uploading...');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const result = await api.uploadFile(formData);
            setFormData(prev => ({ ...prev, [fieldName]: result.url }));
            setUploadStatus('✅ Uploaded!');
            setTimeout(() => setUploadStatus(''), 3000);
        } catch (err) {
            console.error(err);
            setUploadStatus('❌ Upload failed');
            alert('Upload failed. Please use a direct image link instead.');
            setTimeout(() => setUploadStatus(''), 3000);
        }
    };

    // Departments - WITH PIN PROTECTION
    const initiateAddDepartment = () => {
        if (!newDepartment) return;

        // MANDATORY PIN CHECK
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before adding departments.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }

        // PIN is set, ask for verification
        setPendingAction({ type: 'ADD_DEPARTMENT', payload: newDepartment });
        setShowPinModal(true);
    };

    const executeAddDepartment = async (deptName, securityPin) => {
        try {
            await api.createDepartment(deptName, securityPin);
            setNewDepartment('');
            fetchDepartments();
            alert('✅ Department added successfully!');
        } catch (e) {
            console.error('Add department error:', e);
            alert('❌ Failed to add department: ' + (e.message || 'Unknown error'));
        }
    };

    const initiateRemoveDepartment = (id, deptName) => {
        // MANDATORY PIN CHECK (no browser confirm - we'll confirm via PIN modal)
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before deleting departments.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }

        // PIN is set, ask for verification (the PIN modal will serve as confirmation)
        setPendingAction({ type: 'DELETE_DEPARTMENT', payload: { id, name: deptName } });
        setShowPinModal(true);
    };

    const executeRemoveDepartment = async (payload, securityPin) => {
        const id = typeof payload === 'object' ? payload.id : payload;
        try {
            await api.deleteDepartment(id, securityPin);
            fetchDepartments();
            alert('✅ Department deleted successfully!');
        } catch (e) {
            console.error('Delete department error:', e);
            alert('❌ Failed to delete department: ' + (e.message || 'Unknown error'));
        }
    };

    const initiateResetDepartments = () => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before resetting departments.\n\nPlease go to Settings > Security (Firewall) and set a PIN first.');
            setActiveTab('security');
            return;
        }
        setPendingAction({ type: 'RESET_DEPARTMENTS' });
        setShowPinModal(true);
    };

    const executeResetDepartments = async (securityPin) => {
        setLoading(true);
        try {
            const records = await api.getDepartments();
            await Promise.all(records.map(r => api.deleteDepartment(r.id, securityPin)));

            const standardList = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'BIM', 'HBS', 'EVG', 'HR', 'IT'];
            await Promise.all(standardList.map((name, index) => api.createDepartment(name, index + 1, securityPin)));

            fetchDepartments();
            alert('✅ Departments reset to standard list!');
        } catch (e) {
            console.error(e);
            alert('❌ Error resetting departments: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const initiateAddAdmin = () => {
        if (!newAdmin.email || !newAdmin.password) {
            alert('Please fill in required fields (Email, Password)');
            return;
        }

        // MANDATORY PIN CHECK
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before adding admin users.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }

        // PIN is set, ask for verification
        setPendingAction({
            type: 'ADD_ADMIN',
            payload: {
                email: newAdmin.email,
                password: newAdmin.password,
                name: newAdmin.name,
                role: newAdmin.role
            }
        });
        setShowPinModal(true);
    };

    const executeAddAdmin = async (userData, securityPin) => {
        try {
            await api.createUser(userData, securityPin);
            setNewAdmin({ username: '', password: '', name: '', role: 'IT', email: '' });
            fetchAdmins();
            alert('✅ User account created successfully!');
        } catch (e) {
            console.error("Add Admin Error:", e);
            alert(`❌ Error creating user: ${e.message}`);
        }
    };

    const startEditAdmin = (admin) => {
        setEditingAdmin({ ...admin, password: '' });
    };

    const initiateUpdateAdmin = () => {
        // MANDATORY PIN CHECK
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before updating admin users.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }

        // PIN is set, ask for verification
        setPendingAction({
            type: 'UPDATE_ADMIN',
            payload: {
                id: editingAdmin.id,
                email: editingAdmin.email,
                name: editingAdmin.name,
                role: editingAdmin.role,
                password: editingAdmin.password || undefined
            }
        });
        setShowPinModal(true);
    };

    const executeUpdateAdmin = async (updateData, securityPin) => {
        try {
            await api.updateUser(updateData.id, {
                email: updateData.email,
                name: updateData.name,
                role: updateData.role,
                password: updateData.password
            }, securityPin);
            setEditingAdmin(null);
            fetchAdmins();
            alert('✅ Admin details updated successfully!');
        } catch (e) {
            alert(`❌ Failed to update admin: ${e.message}`);
            console.error(e);
        }
    };

    const initiateRemoveAdmin = (id, userName) => {
        // MANDATORY PIN CHECK (no browser confirm - we'll confirm via PIN modal)
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before deleting admin users.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }

        // PIN is set, ask for verification
        setPendingAction({
            type: 'DELETE_ADMIN',
            payload: { id, name: userName }
        });
        setShowPinModal(true);
    };

    const executeRemoveAdmin = async (payload, securityPin) => {
        const id = typeof payload === 'object' ? payload.id : payload;
        try {
            await api.deleteUser(id, securityPin);
            fetchAdmins();
            alert('✅ Admin user deleted successfully!');
        } catch (e) {
            console.error('Delete admin error:', e);
            alert('❌ Failed to remove admin: ' + (e.message || 'Unknown error'));
        }
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
            await api.sendTestEmail(testEmail);
            setTestEmailResult({ success: true, message: "Test Email Sent! Please check your inbox." });
        } catch (e) {
            console.error(e);
            setTestEmailResult({ success: false, message: "Failed: " + e.message });
        } finally {
            setTestEmailLoading(false);
        }
    };

    const handleVerifySMTP = async () => {
        setTestEmailLoading(true);
        setTestEmailResult(null);
        try {
            const res = await api.verifyEmail();
            setTestEmailResult({ success: true, message: res.message });
        } catch (e) {
            console.error(e);
            setTestEmailResult({ success: false, message: "Connection Failed: " + (e.message || "Invalid settings") });
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
        { id: 'email', label: 'Email Config', icon: Mail },
        { id: 'security', label: 'Security (Firewall)', icon: Shield },
        { id: 'backups', label: 'Data Backups', icon: Database },
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
                                <input className="w-full p-2 border rounded-lg" value={formData.company_name || ''} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                                    <div className="flex gap-2">
                                        <input className="w-full p-2 border rounded-lg bg-white text-xs"
                                            value={formData.logo_url || ''}
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
                                            value={formData.background_url || ''}
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
                                    onClick={initiateResetOffices}
                                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                >
                                    Reset to Standard List
                                </button>
                            </div>
                            <div className="flex gap-4 mb-6">
                                <input className="flex-1 p-3 border rounded-xl shadow-sm" value={newOffice} onChange={e => setNewOffice(e.target.value)} placeholder="Enter New Office Name..." />
                                <button onClick={initiateAddOffice} className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-green-700 shadow-md transform hover:-translate-y-0.5 transition"><Plus size={18} /> Add Office</button>
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
                                            <button onClick={() => initiateRemoveOffice(office.id, office.name)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash2 size={18} /></button>
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
                                    onClick={initiateResetDepartments}
                                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                >
                                    Reset to Standard List
                                </button>
                            </div>
                            <div className="flex gap-4 mb-6">
                                <input className="flex-1 p-3 border rounded-xl shadow-sm" placeholder="Enter New Department Name..." value={newDepartment} onChange={e => setNewDepartment(e.target.value)} />
                                <button onClick={initiateAddDepartment} className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-green-700 shadow-md transform hover:-translate-y-0.5 transition"><Plus size={18} /> Add Department</button>
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
                                            <button onClick={() => initiateRemoveDepartment(dept.id, dept.name)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash2 size={18} /></button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'admins' && (
                        <div className="max-w-5xl">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">Admin Accounts</h3>

                            {/* Add/Edit Form */}
                            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm mb-6">
                                <div className="space-y-4">
                                    {/* Row 1: Name and Email */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                                            <input
                                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                                                placeholder="Enter full name"
                                                value={editingAdmin ? (editingAdmin.name || '') : (newAdmin.name || '')}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, name: e.target.value }) : setNewAdmin({ ...newAdmin, name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                                            <input
                                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                                                placeholder="email@example.com"
                                                type="email"
                                                value={editingAdmin ? (editingAdmin.email || '') : newAdmin.email}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, email: e.target.value }) : setNewAdmin({ ...newAdmin, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Row 2: Password, Role, and Current Password (if editing) */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {editingAdmin ? "New Password" : "Password"}
                                            </label>
                                            <input
                                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                                                placeholder={editingAdmin ? "Leave blank to keep current" : "Enter password"}
                                                type="password"
                                                value={editingAdmin ? editingAdmin.password : newAdmin.password}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, password: e.target.value }) : setNewAdmin({ ...newAdmin, password: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                                            <select
                                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-medium transition"
                                                value={editingAdmin ? editingAdmin.role : newAdmin.role}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, role: e.target.value }) : setNewAdmin({ ...newAdmin, role: e.target.value })}
                                            >
                                                <option value="Admin">Admin</option>
                                                <option value="IT">IT Support</option>
                                            </select>
                                        </div>
                                        {editingAdmin && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                                                <input
                                                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                                                    placeholder="Required to change password"
                                                    type="password"
                                                    value={editingAdmin.oldPassword || ''}
                                                    onChange={e => setEditingAdmin({ ...editingAdmin, oldPassword: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        {editingAdmin ? (
                                            <>
                                                <button
                                                    onClick={initiateUpdateAdmin}
                                                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-cyan-600 hover:to-blue-700 flex items-center justify-center gap-2 font-semibold shadow-md transition transform hover:-translate-y-0.5"
                                                >
                                                    <Save size={18} /> Update
                                                </button>
                                                <button
                                                    onClick={() => setEditingAdmin(null)}
                                                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={initiateAddAdmin}
                                                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 flex items-center justify-center gap-2 font-semibold shadow-md transition transform hover:-translate-y-0.5"
                                            >
                                                <Plus size={18} /> Add Admin User
                                            </button>
                                        )}
                                    </div>
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
                                                    {(admin.name || admin.email || 'User').charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-bold block text-gray-900">{admin.name || admin.email}</span>
                                                    {admin.name && (
                                                        <span className="text-xs text-gray-500 block mt-0.5">{admin.email}</span>
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
                                                onClick={() => initiateRemoveAdmin(admin.id, admin.name || admin.email)}
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
                        <div className="space-y-6 max-w-4xl">
                            <form onSubmit={handleSave} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-gray-700">SMTP Server</h3>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Service (e.g. gmail, outlook)</label>
                                            <input className="w-full p-2 border rounded-lg" placeholder="Optional: gmail, outlook, etc." value={formData.smtp_service || ''} onChange={e => setFormData({ ...formData, smtp_service: e.target.value })} />
                                            <p className="text-[10px] text-gray-400 mt-1">If using Gmail, use an "App Password" instead of your real password.</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                                            <input className="w-full p-2 border rounded-lg" placeholder="smtp.example.com" value={formData.smtp_host || ''} onChange={e => setFormData({ ...formData, smtp_host: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                                                <input className="w-full p-2 border rounded-lg" placeholder="587" value={formData.smtp_port || ''} onChange={e => setFormData({ ...formData, smtp_port: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Secure (SSL/TLS)</label>
                                                <select className="w-full p-2 border rounded-lg" value={formData.smtp_secure || 'false'} onChange={e => setFormData({ ...formData, smtp_secure: e.target.value })}>
                                                    <option value="false">No (STARTTLS)</option>
                                                    <option value="true">Yes (SSL/TLS)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-gray-700">Authentication & Identity</h3>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
                                            <input className="w-full p-2 border rounded-lg" value={formData.smtp_user || ''} onChange={e => setFormData({ ...formData, smtp_user: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                            <input type="password" className="w-full p-2 border rounded-lg" value={formData.smtp_pass || ''} onChange={e => setFormData({ ...formData, smtp_pass: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
                                            <input className="w-full p-2 border rounded-lg" placeholder="noreply@company.com" value={formData.smtp_from_address || ''} onChange={e => setFormData({ ...formData, smtp_from_address: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                                            <input className="w-full p-2 border rounded-lg" placeholder="IT Support Team" value={formData.smtp_from_name || ''} onChange={e => setFormData({ ...formData, smtp_from_name: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button type="submit" disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2">
                                        <Save size={18} /> Save Email Settings
                                    </button>
                                    <button type="button" onClick={handleVerifySMTP} disabled={testEmailLoading} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">
                                        Verify Connection
                                    </button>
                                </div>
                            </form>

                            {/* Test Email Section */}
                            <div className="pt-8 border-t border-gray-200">
                                <h4 className="text-md font-bold text-gray-700 mb-4">📧 Send Test Email</h4>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Enter email address..."
                                    />
                                    <button
                                        type="button"
                                        onClick={handleTestEmail}
                                        disabled={testEmailLoading}
                                        className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                                    >
                                        <Mail size={18} /> Send Test
                                    </button>
                                </div>

                                {/* Test Result */}
                                {testEmailResult && (
                                    <div className={`mt-4 p-4 rounded-xl border ${testEmailResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                        <p className="text-sm font-medium">
                                            {testEmailResult.success ? '✅ ' : '❌ '}
                                            {testEmailResult.message}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'security' && (
                        <div className="max-w-4xl space-y-6">
                            <form onSubmit={handleSave} className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-700 mb-4">Security Settings & Firewall</h3>

                                {/* --- PIN MANAGEMENT SECTION --- */}
                                <div className="bg-white border rounded-xl overflow-hidden shadow-sm p-6 mb-6">
                                    <h4 className="text-md font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <Shield size={18} /> Admin Action Security (REQUIRED)
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-4">🔒 All settings changes and backups require PIN verification</p>

                                    {pinStatus ? (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-green-800 font-bold text-sm">✅ Security PIN Active</p>
                                                <p className="text-green-700 text-xs">All settings changes and backups are now protected.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleResetPin}
                                                className="px-4 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                                            >
                                                Reset PIN
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="p-2 bg-orange-100 rounded-lg">
                                                    <Shield className="text-orange-600" size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-orange-800">⚠️ PIN Not Set - Action Required!</p>
                                                    <p className="text-xs text-orange-700 mt-1">
                                                        You must set a security PIN before you can save any settings or trigger backups.
                                                        This PIN will be required every time you make changes.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    className="border-2 border-orange-300 rounded-lg px-3 py-2 text-sm w-56 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                                                    placeholder="Enter new 4-6 digit PIN"
                                                    value={newPin}
                                                    onChange={e => setNewPin(e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleSetPin}
                                                    className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-bold transition shadow-sm"
                                                >
                                                    Set PIN Now
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

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

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Allowed IPs */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Allowed IPs (Whitelist)</label>
                                        <textarea
                                            value={formData.allowed_ips || ''}
                                            onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
                                            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-xs h-40 resize-none shadow-sm"
                                            placeholder="e.g. 192.168.1.1, 10.0.0.5"
                                        />
                                        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                                            These IPs <strong>bypass</strong> the rate limiter. Useful for office static IPs.
                                        </p>
                                    </div>

                                    {/* Blocked IPs */}
                                    <div>
                                        <label className="block text-sm font-bold text-red-700 mb-2">Blocked IPs (Blacklist)</label>
                                        <textarea
                                            value={formData.blocked_ips || ''}
                                            onChange={(e) => setFormData({ ...formData, blocked_ips: e.target.value })}
                                            className="w-full p-3 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-xs bg-red-50/50 h-40 resize-none shadow-sm"
                                            placeholder="e.g. 10.0.0.99"
                                        />
                                        <p className="text-[10px] text-red-600/70 mt-2 leading-relaxed">
                                            IPs listed here are <strong>immediately rejected</strong> (403 Forbidden).
                                        </p>
                                    </div>

                                    {/* Firewall Log */}
                                    <div className="flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-gray-800 flex items-center gap-2">
                                                <Shield size={14} className="text-red-500" /> Recent Events
                                            </label>
                                            <button type="button" onClick={() => api.get('/settings/firewall').then(res => setRecentBlocks(res.recent_blocks))} className="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800 tracking-wider">Refresh</button>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 overflow-hidden font-mono text-xs flex-1 h-40 flex flex-col shadow-sm border border-gray-200">
                                            <div className="flex justify-between border-b border-gray-100 pb-2 mb-2 text-gray-400 text-[10px] uppercase tracking-wider">
                                                <span className="w-1/3">IP</span>
                                                <span className="w-1/3 text-center">Reason</span>
                                                <span className="w-1/3 text-right">Time</span>
                                            </div>
                                            <div className="overflow-y-auto pr-1 space-y-1 custom-scrollbar h-full">
                                                {recentBlocks && recentBlocks.length > 0 ? recentBlocks.map((b, i) => (
                                                    <div key={i} className="flex justify-between items-center hover:bg-gray-50 p-1 rounded transition group">
                                                        <span className="w-1/3 text-red-600 group-hover:text-red-700 truncate font-semibold" title={b.ip}>{b.ip}</span>
                                                        <span className="w-1/3 text-center text-gray-600 text-[10px] truncate" title={b.reason}>{b.reason === 'Rate Limit Exceeded' ? 'Rate Limit' : 'Blacklist'}</span>
                                                        <span className="w-1/3 text-right text-gray-400 group-hover:text-gray-500 text-[10px]">{new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                    </div>
                                                )) : (
                                                    <div className="h-full flex items-center justify-center text-gray-400 italic text-[10px]">No recent events</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-rose-800 transition flex items-center gap-2 shadow-md">
                                    <Save size={18} /> Save Security Settings
                                </button>
                            </form>

                            {/* DANGER ZONE */}
                            <div className="mt-8 pt-8 border-t border-gray-200">
                                <h4 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                                    <Trash2 size={20} /> Danger Zone
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="border border-red-200 bg-red-50 rounded-xl p-5">
                                        <h5 className="font-bold text-gray-800 mb-2">Reset Operations Data</h5>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Deletes all <b>Tickets</b> and resets <b>Inventory Stock</b> to 0.
                                            <br />Items, Settings, and Users are PRESERVED.
                                        </p>
                                        <button type="button" onClick={initiateResetData} className="w-full py-2 bg-white border border-red-300 text-red-700 font-bold rounded-lg hover:bg-red-100 transition">
                                            Reset Data Only
                                        </button>
                                    </div>

                                    <div className="border border-red-500 bg-red-100 rounded-xl p-5 relative overflow-hidden">
                                        <h5 className="font-bold text-red-900 mb-2">Factory Reset (Wipe Site)</h5>
                                        <p className="text-sm text-red-800 mb-4">
                                            <b>DELETES EVERYTHING.</b> Tickets, Inventory Items, Logs, Settings, Offices, Departments.
                                            <br />Cannot be undone.
                                        </p>
                                        <button type="button" onClick={initiateResetSite} className="w-full py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-sm">
                                            ⚠️ Wipe Everything
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {
                        activeTab === 'backups' && (
                            <div className="space-y-8 max-w-4xl">
                                <form onSubmit={handleSave} className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Database size={24} className="text-blue-600" /> Data Backup & Recovery
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="text-md font-semibold text-gray-700">Configuration</h4>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Backup Frequency</label>
                                                <select
                                                    className="w-full p-2.5 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={formData.backup_frequency || 'NEVER'}
                                                    onChange={e => setFormData({ ...formData, backup_frequency: e.target.value })}
                                                >
                                                    <option value="NEVER">Manual Only</option>
                                                    <option value="DAILY">Daily (Midnight)</option>
                                                    <option value="WEEKLY">Weekly (Sundays)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">External Backup Path (Optional)</label>
                                                <input
                                                    className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="e.g. D:\OneDrive\Backups"
                                                    value={formData.backup_path || ''}
                                                    onChange={e => setFormData({ ...formData, backup_path: e.target.value })}
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Enter a local path to automatically copy backups (e.g. your OneDrive sync folder).
                                                </p>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-sm font-bold text-gray-700">OneDrive / SharePoint Cloud Backup</h4>
                                                    <div className="flex items-center">
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={formData.onedrive_enabled === 'true'} onChange={e => setFormData({ ...formData, onedrive_enabled: e.target.checked ? 'true' : 'false' })} />
                                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                        </label>
                                                    </div>
                                                </div>

                                                {formData.onedrive_enabled === 'true' && (
                                                    <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm">
                                                        <p className="text-xs text-blue-800">
                                                            <b>Direct Cloud Upload (Docker Friendly)</b><br />
                                                            Requires Microsoft Graph API credentials. <a href="#" onClick={e => { e.preventDefault(); alert("1. Register App in Azure Portal.\n2. Add 'Files.ReadWrite.All' & 'offline_access' permissions.\n3. Generate Client Secret.\n4. Use a tool (like Postman or a script) to get the initial Refresh Token.") }} className="underline">How to get these?</a>
                                                        </p>
                                                        <div>
                                                            <input className="w-full p-2 border rounded bg-white text-xs" placeholder="Client ID (Application ID)" value={formData.onedrive_client_id || ''} onChange={e => setFormData({ ...formData, onedrive_client_id: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <input className="w-full p-2 border rounded bg-white text-xs" type="password" placeholder="Client Secret" value={formData.onedrive_client_secret || ''} onChange={e => setFormData({ ...formData, onedrive_client_secret: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <input className="w-full p-2 border rounded bg-white text-xs" type="password" placeholder="Refresh Token (Monitoring)" value={formData.onedrive_refresh_token || ''} onChange={e => setFormData({ ...formData, onedrive_refresh_token: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <input className="w-full p-2 border rounded bg-white text-xs" placeholder="Target Folder (e.g. Backups)" value={formData.onedrive_folder || ''} onChange={e => setFormData({ ...formData, onedrive_folder: e.target.value })} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm w-full">
                                                <Save size={16} className="inline mr-2" /> Save Configuration
                                            </button>
                                        </div>

                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4">
                                            <div className="p-3 bg-white rounded-full shadow-sm text-blue-600">
                                                <Database size={32} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-800">Manual Backup</h4>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    Trigger an immediate backup of the database and uploads.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={triggerBackup}
                                                disabled={backupLoading}
                                                className="px-6 py-3 bg-white text-blue-700 border border-blue-200 rounded-xl font-bold hover:bg-blue-50 transition shadow-sm w-full"
                                            >
                                                {backupLoading ? 'Backing up...' : 'Trigger Backup Now'}
                                            </button>
                                            {backupStatus && (
                                                <div className={`text-xs font-semibold px-3 py-1 rounded-full ${backupStatus.includes('Success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {backupStatus}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </form>

                                <div className="border-t pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-lg font-bold text-gray-700">Recent Backups</h4>
                                        <button onClick={fetchBackups} className="text-sm text-blue-600 hover:underline">Refresh List</button>
                                    </div>
                                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="p-3 font-semibold text-gray-600">Backup Name</th>
                                                    <th className="p-3 font-semibold text-gray-600">Created At</th>
                                                    <th className="p-3 font-semibold text-gray-600 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {backups.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="3" className="p-8 text-center text-gray-400">
                                                            No backups found.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    backups.map((backup, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="p-3 font-medium text-gray-800">{backup.name}</td>
                                                            <td className="p-3 text-gray-600">
                                                                {new Date(backup.created).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                {backup.status !== 'SUCCESS' ? (
                                                                    <span className="text-xs text-red-600 px-2 py-1 bg-red-100 rounded-md font-bold" title={backup.details}>
                                                                        Failed
                                                                    </span>
                                                                ) : backup.type === 'CLOUD' ? (
                                                                    <span className="text-xs text-green-700 px-2 py-1 bg-green-100 rounded-md font-bold border border-green-200">
                                                                        ☁️ OneDrive Cloud
                                                                    </span>
                                                                ) : backup.type === 'HYBRID' ? (
                                                                    <span className="text-xs text-blue-700 px-2 py-1 bg-blue-100 rounded-md font-bold border border-blue-200">
                                                                        ☁️ Cloud + Local
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-md border border-gray-200">
                                                                        💾 Stored Locally
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )
                    }


                    {/* PIN VERIFICATION MODAL */}
                    {
                        showPinModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                                    <div className="text-center mb-6">
                                        <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                            <Shield size={24} />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-800">Security Check</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {pendingAction?.type === 'DELETE_OFFICE' && pendingAction?.payload?.name
                                                ? `⚠️ Delete office "${pendingAction.payload.name}"? Enter PIN to confirm.`
                                                : pendingAction?.type === 'ADD_OFFICE'
                                                    ? `Add new office "${pendingAction.payload}"? Enter PIN to confirm.`
                                                    : pendingAction?.type === 'DELETE_DEPARTMENT' && pendingAction?.payload?.name
                                                        ? `⚠️ Delete department "${pendingAction.payload.name}"? Enter PIN to confirm.`
                                                        : pendingAction?.type === 'ADD_DEPARTMENT'
                                                            ? `Add new department "${pendingAction.payload}"? Enter PIN to confirm.`
                                                            : pendingAction?.type === 'DELETE_ADMIN' && pendingAction?.payload?.name
                                                                ? `⚠️ Delete admin user "${pendingAction.payload.name}"? Enter PIN to confirm.`
                                                                : pendingAction?.type === 'ADD_ADMIN'
                                                                    ? `Add new admin user "${pendingAction.payload.email}"? Enter PIN to confirm.`
                                                                    : pendingAction?.type === 'UPDATE_ADMIN'
                                                                        ? `Update admin user "${pendingAction.payload.email}"? Enter PIN to confirm.`
                                                                        : pendingAction?.type === 'BACKUP'
                                                                            ? 'Trigger backup? Enter your admin PIN to proceed.'
                                                                            : 'Enter your admin PIN to save changes.'
                                            }
                                        </p>
                                    </div>

                                    <form onSubmit={(e) => { e.preventDefault(); confirmPinAction(); }}>
                                        <input
                                            type="password"
                                            autoFocus
                                            className="w-full text-center text-2xl tracking-widest font-bold border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                            placeholder="• • • • • •"
                                            value={pinInput}
                                            onChange={e => setPinInput(e.target.value)}
                                        />

                                        <div className="grid grid-cols-2 gap-3 mt-6">
                                            <button
                                                type="button"
                                                onClick={() => { setShowPinModal(false); setPinInput(''); setPendingAction(null); }}
                                                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
                                            >
                                                Confirm
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div >
        </div >
    );
};

export default DashboardSettings;
