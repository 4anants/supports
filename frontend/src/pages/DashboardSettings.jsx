import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Save, Upload, Trash2, Plus, Layout, Users, MapPin, Mail, Layers, Shield, Database, Cloud } from 'lucide-react';
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
    const [newAdmin, setNewAdmin] = useState({ username: '', password: '', name: '', role: 'IT', email: '', avatar: '' });
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
        } else if (pendingAction?.type === 'CLEANUP_STORAGE') {
            await executeCleanup(pin);
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

    const initiateCleanup = () => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before performing cleanup.\n\nPlease go to the "Security (Firewall)" tab and set a PIN first.');
            setActiveTab('security');
            return;
        }
        setPendingAction({ type: 'CLEANUP_STORAGE' });
        setShowPinModal(true);
    };

    const executeCleanup = async (securityPin) => {
        try {
            const res = await api.post('/settings/cleanup', {}, { securityPin });
            if (res.success) {
                alert(`✅ Cleanup Complete!\n\n${res.message}`);
            } else {
                alert('❌ Cleanup Failed: ' + res.message);
            }
        } catch (e) {
            console.error(e);
            alert('❌ Cleanup Error: ' + e.message);
        }
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

    // Admin Avatar Upload Handler
    const handleAdminFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Use a temporary status or existing one
        const formData = new FormData();
        formData.append('file', file);

        try {
            const result = await api.uploadFile(formData);
            if (editingAdmin) {
                setEditingAdmin(prev => ({ ...prev, avatar: result.url }));
            } else {
                setNewAdmin(prev => ({ ...prev, avatar: result.url }));
            }
            alert('✅ Photo Uploaded!');
        } catch (err) {
            console.error(err);
            alert('❌ Upload failed: ' + err.message);
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
                role: newAdmin.role,
                avatar: newAdmin.avatar
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
                avatar: editingAdmin.avatar,
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
                avatar: updateData.avatar,
                password: updateData.password
            }, securityPin);
            setEditingAdmin(null);
            fetchAdmins();

            // Update local session if self-update so Sidebar Avatar updates immediately
            const currentUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
            if (currentUser.id === updateData.id) {
                const updatedUser = { ...currentUser, ...updateData };
                // Ensure we don't store plain password if it was passed
                delete updatedUser.password;
                localStorage.setItem('adminUser', JSON.stringify(updatedUser));
                // Short delay to allow user to see alert, then reload
                setTimeout(() => window.location.reload(), 500);
            }

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
            <h2 className="text-2xl font-bold text-white mb-6">System Settings</h2>

            <div className="flex flex-col flex-1 overflow-hidden bg-[#1e293b] rounded-2xl shadow-sm border border-slate-700/50">
                {/* Top Tabs */}
                <div className="w-full bg-[#1e293b] border-b border-slate-700 flex overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-cyan-500 text-cyan-400 bg-cyan-900/10' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 overflow-y-auto bg-[#0f172a]">
                    {activeTab === 'general' && (
                        <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Company Name</label>
                                <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none" value={formData.company_name || ''} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Logo</label>
                                    <div className="flex gap-2">
                                        <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-xs text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                            value={formData.logo_url || ''}
                                            placeholder="Paste direct link (https://.../logo.png)"
                                            onChange={e => setFormData({ ...formData, logo_url: e.target.value })}
                                        />
                                        <label className="cursor-pointer bg-blue-900/30 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-lg hover:bg-blue-900/50 transition">
                                            <Upload size={16} />
                                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'logo_url')} />
                                        </label>
                                    </div>
                                    {uploadStatus && <div className="text-xs mt-1 text-blue-400 font-medium">{uploadStatus}</div>}
                                    {formData.logo_url && (
                                        <img
                                            src={formData.logo_url}
                                            className="h-32 mt-2 object-contain border border-slate-600 p-2 rounded bg-[#1e293b]"
                                            alt="Preview"
                                            onError={(e) => { e.target.style.display = 'none'; alert("Error: Logo link is broken. Make sure it's a direct image link."); }}
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Background</label>
                                    <div className="flex gap-2">
                                        <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-xs text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                            value={formData.background_url || ''}
                                            placeholder="Paste direct link (https://.../bg.jpg)"
                                            onChange={e => setFormData({ ...formData, background_url: e.target.value })}
                                        />
                                        <label className="cursor-pointer bg-blue-900/30 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-lg hover:bg-blue-900/50 transition">
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
                                <h3 className="text-lg font-bold text-white">Office Locations</h3>
                                <button
                                    onClick={initiateResetOffices}
                                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                >
                                    Reset to Standard List
                                </button>
                            </div>
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <input className="flex-1 p-3 border border-slate-600 rounded-xl shadow-sm bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none" value={newOffice} onChange={e => setNewOffice(e.target.value)} placeholder="Enter New Office Name..." />
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
                                        <div key={office.id} className="p-4 border border-slate-700/50 rounded-xl flex justify-between items-center bg-[#1e293b] shadow-sm hover:shadow-md transition">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg"><MapPin size={20} /></div>
                                                <span className="font-semibold text-slate-200">{office.name}</span>
                                            </div>
                                            <button onClick={() => initiateRemoveOffice(office.id, office.name)} className="text-slate-500 hover:text-red-400 hover:bg-slate-800 p-2 rounded-lg transition"><Trash2 size={18} /></button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'departments' && (
                        <div className="max-w-4xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white">Departments</h3>
                                <button
                                    onClick={initiateResetDepartments}
                                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                >
                                    Reset to Standard List
                                </button>
                            </div>
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <input className="flex-1 p-3 border border-slate-600 rounded-xl shadow-sm bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none" placeholder="Enter New Department Name..." value={newDepartment} onChange={e => setNewDepartment(e.target.value)} />
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
                                        <div key={dept.id} className="p-4 border border-slate-700/50 rounded-xl flex justify-between items-center bg-[#1e293b] shadow-sm hover:shadow-md transition">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-900/30 text-purple-400 rounded-lg"><Layers size={20} /></div>
                                                <span className="font-semibold text-slate-200">{dept.name}</span>
                                            </div>
                                            <button onClick={() => initiateRemoveDepartment(dept.id, dept.name)} className="text-slate-500 hover:text-red-400 hover:bg-slate-800 p-2 rounded-lg transition"><Trash2 size={18} /></button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'admins' && (
                        <div className="max-w-5xl">
                            <h3 className="text-lg font-bold text-white mb-4">Admin Accounts</h3>

                            {/* Add/Edit Form */}
                            <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700 shadow-sm mb-6">
                                <div className="space-y-4">
                                    {/* Row 1: Name and Email */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="adminName" className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                                            <input
                                                id="adminName"
                                                name="name"
                                                className="w-full p-3 border border-slate-600 rounded-lg bg-[#0f172a] text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition outline-none"
                                                placeholder="Enter full name"
                                                value={editingAdmin ? (editingAdmin.name || '') : (newAdmin.name || '')}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, name: e.target.value }) : setNewAdmin({ ...newAdmin, name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                                            <input
                                                id="adminEmail"
                                                name="email"
                                                className="w-full p-3 border border-slate-600 rounded-lg bg-[#0f172a] text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition outline-none"
                                                placeholder="email@example.com"
                                                type="email"
                                                value={editingAdmin ? (editingAdmin.email || '') : newAdmin.email}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, email: e.target.value }) : setNewAdmin({ ...newAdmin, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Row 1.5: Avatar URL */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Profile Photo</label>
                                        <div className="flex gap-2 items-center">
                                            {/* Input Field */}
                                            <input
                                                className="flex-1 p-3 border border-slate-600 rounded-lg bg-[#0f172a] text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-sm outline-none"
                                                placeholder="https://... (or upload)"
                                                value={editingAdmin ? (editingAdmin.avatar || '') : (newAdmin.avatar || '')}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, avatar: e.target.value }) : setNewAdmin({ ...newAdmin, avatar: e.target.value })}
                                            />

                                            {/* Upload Button */}
                                            <label className="cursor-pointer bg-blue-900/30 text-blue-400 border border-blue-500/30 px-4 py-3 rounded-lg hover:bg-blue-900/50 transition shadow-sm flex items-center gap-2">
                                                <Upload size={18} />
                                                <span className="text-sm font-bold">Upload</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleAdminFileUpload} />
                                            </label>

                                            {/* Preview */}
                                            {(editingAdmin?.avatar || newAdmin?.avatar) && (
                                                <img
                                                    src={editingAdmin ? editingAdmin.avatar : newAdmin.avatar}
                                                    alt="Preview"
                                                    className="w-12 h-12 rounded-full object-cover border border-slate-600 shadow-sm"
                                                    onError={(e) => e.target.style.display = 'none'}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 2: Password, Role, and Current Password (if editing) */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                                {editingAdmin ? "New Password" : "Password"}
                                            </label>
                                            <input
                                                className="w-full p-3 border border-slate-600 rounded-lg bg-[#0f172a] text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition outline-none"
                                                placeholder={editingAdmin ? "Leave blank to keep current" : "Enter password"}
                                                type="password"
                                                value={editingAdmin ? editingAdmin.password : newAdmin.password}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, password: e.target.value }) : setNewAdmin({ ...newAdmin, password: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                                            <select
                                                className="w-full p-3 border border-slate-600 rounded-lg bg-[#0f172a] text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-medium transition outline-none"
                                                value={editingAdmin ? editingAdmin.role : newAdmin.role}
                                                onChange={e => editingAdmin ? setEditingAdmin({ ...editingAdmin, role: e.target.value }) : setNewAdmin({ ...newAdmin, role: e.target.value })}
                                            >
                                                <option value="Admin">Admin</option>
                                                <option value="IT">IT Support</option>
                                            </select>
                                        </div>
                                        {editingAdmin && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
                                                <input
                                                    className="w-full p-3 border border-slate-600 rounded-lg bg-[#0f172a] text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition outline-none"
                                                    placeholder="Required to change password"
                                                    type="password"
                                                    value={editingAdmin.oldPassword || ''}
                                                    onChange={e => setEditingAdmin({ ...editingAdmin, oldPassword: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col md:flex-row gap-3 pt-2">
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
                                                    className="px-6 py-3 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 font-medium transition"
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
                                    <div key={admin.id} className="p-5 border border-slate-700/50 rounded-xl bg-[#1e293b] shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                        {/* Gradient Accent */}
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600"></div>

                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                                                    {(admin.name || admin.email || 'User').charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-bold block text-white">{admin.name || admin.email}</span>
                                                    {admin.name && (
                                                        <span className="text-xs text-slate-400 block mt-0.5">{admin.email}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Role Badge */}
                                        <div className="mb-3">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${admin.role === 'Admin'
                                                ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30'
                                                : 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/30'
                                                }`}>
                                                {admin.role || 'IT Support'}
                                            </span>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => startEditAdmin(admin)}
                                                className="flex-1 text-sm px-3 py-2 bg-cyan-900/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-900/40 transition-all font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => initiateRemoveAdmin(admin.id, admin.name || admin.email)}
                                                className="px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition border border-transparent"
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
                                        <h3 className="text-lg font-bold text-white">SMTP Server</h3>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Email Service (e.g. gmail, outlook)</label>
                                            <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" placeholder="Optional: gmail, outlook, etc." value={formData.smtp_service || ''} onChange={e => setFormData({ ...formData, smtp_service: e.target.value })} />
                                            <p className="text-[10px] text-slate-500 mt-1">If using Gmail, use an "App Password" instead of your real password.</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">SMTP Host</label>
                                            <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" placeholder="smtp.example.com" value={formData.smtp_host || ''} onChange={e => setFormData({ ...formData, smtp_host: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
                                                <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" placeholder="587" value={formData.smtp_port || ''} onChange={e => setFormData({ ...formData, smtp_port: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-1">Secure (SSL/TLS)</label>
                                                <select className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" value={formData.smtp_secure || 'false'} onChange={e => setFormData({ ...formData, smtp_secure: e.target.value })}>
                                                    <option value="false">No (STARTTLS)</option>
                                                    <option value="true">Yes (SSL/TLS)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white">Authentication & Identity</h3>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Username / Email</label>
                                            <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" value={formData.smtp_user || ''} onChange={e => setFormData({ ...formData, smtp_user: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                                            <input type="password" className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" value={formData.smtp_pass || ''} onChange={e => setFormData({ ...formData, smtp_pass: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Sender Email</label>
                                            <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" placeholder="noreply@company.com" value={formData.smtp_from_address || ''} onChange={e => setFormData({ ...formData, smtp_from_address: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Sender Name</label>
                                            <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" placeholder="IT Support Team" value={formData.smtp_from_name || ''} onChange={e => setFormData({ ...formData, smtp_from_name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Notification Recipient (Backup Alerts)</label>
                                            <input className="w-full p-2 border border-slate-600 rounded-lg bg-[#1e293b] text-white focus:border-cyan-500 focus:ring-1 outline-none" placeholder="admin@company.com" value={formData.notification_email || ''} onChange={e => setFormData({ ...formData, notification_email: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button type="submit" disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2">
                                        <Save size={18} /> Save Email Settings
                                    </button>
                                    <button type="button" onClick={handleVerifySMTP} disabled={testEmailLoading} className="px-6 py-3 bg-slate-700 text-slate-200 rounded-xl font-bold hover:bg-slate-600 transition">
                                        Verify Connection
                                    </button>
                                </div>
                            </form>

                            {/* Test Email Section */}
                            <div className="pt-8 border-t border-slate-700">
                                <h4 className="text-md font-bold text-white mb-4">📧 Send Test Email</h4>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        className="flex-1 p-3 border border-slate-600 rounded-xl bg-[#1e293b] text-white focus:ring-2 focus:ring-cyan-500 outline-none"
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
                                    <div className={`mt-4 p-4 rounded-xl border ${testEmailResult.success ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-red-900/20 border-red-500/30 text-red-400'}`}>
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
                        <div className="h-full flex flex-col">
                            <form onSubmit={handleSave} className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar content-start">

                                {/* Column 1: Access Control (PIN & Danger) */}
                                <div className="space-y-6">
                                    {/* PIN Management */}
                                    <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-sm p-4 relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                                        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                            <Shield size={16} className="text-blue-500" /> Admin Access PIN
                                        </h4>
                                        <p className="text-[10px] text-slate-400 mb-3">Required for critical actions.</p>

                                        {pinStatus ? (
                                            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-green-400 flex items-center gap-1"><Shield size={12} /> PIN Active</span>
                                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                                </div>
                                                <button type="button" onClick={handleResetPin} className="w-full py-1.5 bg-[#1e293b] border border-green-500/30 text-green-400 hover:bg-green-900/30 rounded text-xs font-bold transition">Reset PIN</button>
                                            </div>
                                        ) : (
                                            <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-3">
                                                <p className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-1"><Shield size={12} /> Not Set</p>
                                                <div className="flex gap-2">
                                                    <input type="password" className="w-[80px] p-1 text-xs border border-slate-600 rounded bg-[#0f172a] text-white" placeholder="PIN" value={newPin} onChange={e => setNewPin(e.target.value)} />
                                                    <button type="button" onClick={handleSetPin} className="flex-1 py-1 bg-orange-600 text-white rounded text-xs font-bold hover:bg-orange-700">Set</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 relative text-red-200">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
                                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Trash2 size={16} /> Danger Zone</h4>
                                        <div className="space-y-3">
                                            <button type="button" onClick={initiateResetData} className="w-full py-2 bg-[#1e293b] border border-red-500/30 text-red-400 hover:bg-red-900/30 rounded-lg text-xs font-bold transition text-left px-3">
                                                Reset Operations Data
                                            </button>
                                            <button type="button" onClick={initiateResetSite} className="w-full py-2 bg-red-600/80 text-white hover:bg-red-700 rounded-lg text-xs font-bold transition text-left px-3 shadow-sm">
                                                ⚠️ Factory Reset (Wipe)
                                            </button>
                                            <button type="button" onClick={initiateCleanup} className="w-full py-2 bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 rounded-lg text-xs font-bold transition text-left px-3">
                                                🧹 Cleanup Unused Storage
                                            </button>
                                        </div>
                                    </div>

                                    <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-sm">
                                        <Save size={16} /> Save Changes
                                    </button>
                                </div>

                                {/* Column 2: Firewall Rules */}
                                <div className="space-y-6">
                                    {/* Firewall Status */}
                                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
                                        <div className="p-2 bg-amber-500/20 rounded-full text-amber-500"><Shield size={16} /></div>
                                        <div>
                                            <p className="text-xs font-bold text-amber-200">Firewall Active</p>
                                            <p className="text-[10px] text-amber-400">Limits: 300 req/15min</p>
                                        </div>
                                    </div>

                                    {/* Whitelist */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1"><span className="text-green-500">●</span> Allowed IPs</label>
                                        <textarea
                                            value={formData.allowed_ips || ''}
                                            onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
                                            className="w-full p-2 border border-slate-600 rounded-lg bg-[#0f172a] text-slate-300 focus:ring-1 focus:ring-cyan-500 font-mono text-[10px] h-32 resize-none leading-relaxed outline-none"
                                            placeholder="192.168.1.1..."
                                        />
                                    </div>

                                    {/* Blacklist */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1"><span className="text-red-500">●</span> Blocked IPs</label>
                                        <textarea
                                            value={formData.blocked_ips || ''}
                                            onChange={(e) => setFormData({ ...formData, blocked_ips: e.target.value })}
                                            className="w-full p-2 border border-red-900/50 rounded-lg focus:ring-1 focus:ring-red-500 font-mono text-[10px] h-32 bg-red-900/10 text-red-200 resize-none leading-relaxed outline-none"
                                            placeholder="10.0.0.99..."
                                        />
                                    </div>
                                </div>

                                {/* Column 3: Telemetry */}
                                <div className="flex flex-col h-full overflow-hidden">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-bold text-white flex items-center gap-2"><Shield size={14} /> Recent Blocks</h4>
                                        <button type="button" onClick={() => api.get('/settings/firewall').then(res => setRecentBlocks(res.recent_blocks))} className="text-[10px] font-bold text-cyan-400 hover:underline">Refresh</button>
                                    </div>
                                    <div className="bg-[#1e293b] rounded-xl border border-slate-700 flex-1 overflow-hidden flex flex-col">
                                        <div className="flex justify-between px-3 py-2 bg-[#0f172a] border-b border-slate-700 text-[10px] font-bold text-slate-400 uppercase">
                                            <span>Target</span>
                                            <span>Time</span>
                                        </div>
                                        <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                            {recentBlocks && recentBlocks.length > 0 ? recentBlocks.map((b, i) => (
                                                <div key={i} className="flex justify-between items-center bg-[#0f172a] p-2 rounded border border-slate-700/50 shadow-sm text-[10px]">
                                                    <span className="font-mono font-bold text-red-400 truncate max-w-[100px]" title={b.ip}>{b.ip}</span>
                                                    <span className="text-slate-500">{new Date(b.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                            )) : (
                                                <div className="text-center py-10 text-gray-400 text-[10px] italic">No recent blocks</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'backups' && (
                        <div className="h-full flex flex-col">
                            <form onSubmit={handleSave} className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar content-start">
                                {/* Col 1: Core Configuration */}
                                <div className="space-y-6">
                                    <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-sm p-4 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Database size={16} className="text-blue-500" /> Core Settings</h4>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 mb-1">Backup Schedule</label>
                                                <select
                                                    className="w-full p-2 text-xs border border-slate-600 rounded-lg bg-[#0f172a] text-white font-medium outline-none"
                                                    value={formData.backup_frequency || 'NEVER'}
                                                    onChange={e => setFormData({ ...formData, backup_frequency: e.target.value })}
                                                >
                                                    <option value="NEVER">Manual Only</option>
                                                    <option value="DAILY">Daily (Midnight)</option>
                                                    <option value="WEEKLY">Weekly (Sundays)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 mb-1">Local Path (Optional)</label>
                                                <input
                                                    className="w-full p-2 text-xs border border-slate-600 rounded-lg bg-[#0f172a] text-white outline-none"
                                                    placeholder="D:\Backups"
                                                    value={formData.backup_path || ''}
                                                    onChange={e => setFormData({ ...formData, backup_path: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-center">
                                        <h4 className="text-sm font-bold text-blue-400 mb-2">Manual Action</h4>
                                        <p className="text-[10px] text-blue-300 mb-3">Trigger immediate backup.</p>
                                        <button
                                            type="button"
                                            onClick={triggerBackup}
                                            disabled={backupLoading}
                                            className="w-full py-2 bg-[#1e293b] text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition shadow-sm"
                                        >
                                            {backupLoading ? 'Working...' : 'Backup Now'}
                                        </button>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-sm">
                                        <Save size={16} /> Save Changes
                                    </button>
                                </div>

                                {/* Col 2: OneDrive Cloud */}
                                <div className="space-y-4">
                                    <div className={`border rounded-xl p-4 transition-colors ${formData.onedrive_enabled === 'true' ? 'bg-[#1e293b] border-blue-500/50 shadow-sm' : 'bg-[#0f172a] border-slate-700 opacity-75'}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-white flex items-center gap-2"><Cloud size={16} className="text-blue-500" /> Cloud Backup</h4>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={formData.onedrive_enabled === 'true'} onChange={e => setFormData({ ...formData, onedrive_enabled: e.target.checked ? 'true' : 'false' })} />
                                                <div className="w-8 h-4 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        {formData.onedrive_enabled === 'true' && (
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Client ID</label>
                                                    <input className="w-full p-1.5 text-xs border border-slate-600 bg-[#0f172a] text-white rounded outline-none" value={formData.onedrive_client_id || ''} onChange={e => setFormData({ ...formData, onedrive_client_id: e.target.value })} placeholder="Azure Client ID" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Client Secret</label>
                                                    <input className="w-full p-1.5 text-xs border border-slate-600 bg-[#0f172a] text-white rounded outline-none" type="password" value={formData.onedrive_client_secret || ''} onChange={e => setFormData({ ...formData, onedrive_client_secret: e.target.value })} placeholder="Azure Secret" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">OneDrive Folder</label>
                                                    <input className="w-full p-1.5 text-xs border border-slate-600 bg-[#0f172a] text-white rounded outline-none" value={formData.onedrive_folder || ''} onChange={e => setFormData({ ...formData, onedrive_folder: e.target.value })} placeholder="Backups" />
                                                </div>
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Token Status</label>
                                                        <div className={`p-1.5 text-xs text-center border rounded font-bold ${formData.onedrive_refresh_token ? 'bg-green-900/20 text-green-400 border-green-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'}`}>
                                                            {formData.onedrive_refresh_token ? 'Authorized' : 'Missing'}
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => {/* ... (Same Logic as original but inline?) No, too big. I'll rely on global handler if I kept it or recreate small one */
                                                        // Re-implementing simplified auth click
                                                        const clientId = formData.onedrive_client_id;
                                                        const redirectUri = `${window.location.origin}/onedrive-callback`;
                                                        if (!clientId) return alert("Enter Client ID.");
                                                        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&scope=Files.ReadWrite.All%20offline_access&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
                                                        const popup = window.open(authUrl, "OneDrive Auth", "width=600,height=700");

                                                        const handleMessage = async (event) => {
                                                            if (event.data?.type === 'ONEDRIVE_CODE') {
                                                                window.removeEventListener('message', handleMessage);
                                                                const code = event.data.code;
                                                                try {
                                                                    const res = await api.post('/settings/onedrive/authorize', { code, client_id: clientId, client_secret: formData.onedrive_client_secret, redirect_uri: redirectUri });
                                                                    setFormData(prev => ({ ...prev, onedrive_refresh_token: res.refresh_token }));
                                                                    alert("Connected!");
                                                                } catch (e) { alert("Failed: " + e.message); }
                                                            }
                                                        };
                                                        window.addEventListener('message', handleMessage);
                                                    }} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">Auth</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 p-2 bg-[#1e293b] rounded border border-slate-700">
                                        Redirect URI: <code className="font-mono select-all bg-[#0f172a] px-1 border border-slate-600 rounded text-cyan-400">{window.location.origin}/onedrive-callback</code>
                                    </div>
                                </div>

                                <div className="flex flex-col h-full overflow-hidden">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-bold text-white">History</h4>
                                        <button onClick={fetchBackups} className="text-[10px] text-cyan-400 font-bold hover:underline">Refresh</button>
                                    </div>
                                    <div className="bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                                        <div className="flex justify-between px-3 py-2 bg-[#0f172a] border-b border-slate-700 text-[10px] font-bold text-slate-400 uppercase">
                                            <span>Date</span>
                                            <span>Status</span>
                                        </div>
                                        <div className="overflow-y-auto p-0 space-y-0 custom-scrollbar">
                                            {backups.map((b, i) => (
                                                <div key={i} className="flex justify-between items-center p-3 border-b border-slate-700/50 last:border-0 hover:bg-[#0f172a] transition">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-200">{new Date(b.created).toLocaleDateString()}</p>
                                                        <p className="text-[10px] text-slate-500">{new Date(b.created).toLocaleTimeString()}</p>
                                                    </div>
                                                    {b.status === 'SUCCESS' ? <span className="text-[10px] font-bold text-green-400 bg-green-900/20 px-2 py-1 rounded">OK</span> : <span className="text-[10px] font-bold text-red-400 bg-red-900/20 px-2 py-1 rounded">FAIL</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}


                    {/* PIN VERIFICATION MODAL */}
                    {
                        showPinModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                                <div className="bg-[#1e293b] rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 border border-slate-700">
                                    <div className="text-center mb-6">
                                        <div className="mx-auto w-12 h-12 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mb-3">
                                            <Shield size={24} />
                                        </div>
                                        <h3 className="text-lg font-bold text-white">Security Check</h3>
                                        <p className="text-sm text-slate-400 mt-1">
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
                                            className="w-full text-center text-2xl tracking-widest font-bold border-2 border-slate-600 rounded-xl p-3 bg-[#0f172a] text-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-900/20 transition-all outline-none"
                                            placeholder="Enter PIN"
                                            value={pinInput}
                                            onChange={e => setPinInput(e.target.value)}
                                        />

                                        <div className="grid grid-cols-2 gap-3 mt-6">
                                            <button
                                                type="button"
                                                onClick={() => { setShowPinModal(false); setPinInput(''); setPendingAction(null); }}
                                                className="px-4 py-2 bg-slate-700 text-slate-200 font-medium rounded-lg hover:bg-slate-600 transition"
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
