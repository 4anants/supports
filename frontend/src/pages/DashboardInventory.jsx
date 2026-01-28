import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Archive, History, MinusCircle, FileSpreadsheet, Filter, Upload, Download, Trash2, X, Search, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardInventory = () => {
    const adminUser = JSON.parse(localStorage.getItem('adminUser'));
    // Exact order requested by user
    const PREDEFINED_ORDER = [
        "Mouse",
        "Headphones",
        "Mouse Pads",
        "Keyboard",
        "Webcam",
        "RAM",
        "Graphic Card",
        "SMPS",
        "Monitor",
        "CPU"
    ];
    const [items, setItems] = useState([]);
    const [offices, setOffices] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const navigate = useNavigate();

    // PIN Protection State
    const [pinStatus, setPinStatus] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pendingAction, setPendingAction] = useState(null); // { type: 'DELETE_ITEM', payload: id }

    // Transaction Modals
    const [showRestockModal, setShowRestockModal] = useState(null); // Item object
    const [showIssueModal, setShowIssueModal] = useState(null); // Item object
    const [showHistoryModal, setShowHistoryModal] = useState(null); // Item object
    const [showEditThresholdModal, setShowEditThresholdModal] = useState(null); // Item object

    // Filter & Report States
    const [activeOffice, setActiveOffice] = useState('All');
    const [reportDate, setReportDate] = useState({
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    });

    // Matrix Form State
    const [matrixValues, setMatrixValues] = useState({}); // { "ItemName:::OfficeName": quantity }
    const [matrixThresholds, setMatrixThresholds] = useState({}); // { "ItemName": threshold }
    const [customRowNames, setCustomRowNames] = useState([]);
    const [matrixNewItemName, setMatrixNewItemName] = useState('');
    const [isCorrectionMode, setIsCorrectionMode] = useState(false);

    // Legacy State (kept to prevent breakage if referenced elsewhere, though unused now)
    const [newItem, setNewItem] = useState({ item_name: '', category: 'Hardware', office_location: '', quantity: 0 });
    const [transactionAmount, setTransactionAmount] = useState(1);
    const [transactionReason, setTransactionReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLowStock, setFilterLowStock] = useState(false);
    const [itemLogs, setItemLogs] = useState([]); // For history modal
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Report Preview State
    const [reportPreview, setReportPreview] = useState(null); // { title, headers, rows, filename }

    const fetchItems = async () => {
        try {
            const itemsList = await api.getInventory();
            setItems(itemsList);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchItems();
        api.getOffices().then(officeList => {
            // Sort offices by specific order
            const OFFICE_ORDER = ['AMD', 'HYD', 'VA', 'MD', 'WIN', 'El Salvador'];
            const sortedOffices = officeList.sort((a, b) => {
                const indexA = OFFICE_ORDER.indexOf(a.name);
                const indexB = OFFICE_ORDER.indexOf(b.name);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.name.localeCompare(b.name);
            });

            setOffices(sortedOffices);
            if (sortedOffices.length > 0 && !newItem.office_location) {
                setNewItem(prev => ({ ...prev, office_location: sortedOffices[0].name }));
            }
        });
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

    // Helper to log transactions
    const logTransaction = async (item, change, type, reason) => {
        try {
            const adminUser = JSON.parse(localStorage.getItem('adminUser'));
            await api.createInventoryLog({
                itemId: item.id || 'new',
                itemName: item.item_name || newItem.item_name,
                office: item.office_location || newItem.office_location,
                change: parseInt(change),
                type: type, // 'INITIAL', 'RESTOCK', 'ISSUE'
                reason: reason || '',
                performedBy: adminUser?.full_name || 'Admin'
            });
        } catch (err) {
            console.error("Failed to log transaction", err);
        }
    };

    // Matrix Handlers
    const toggleCorrectionMode = () => {
        const newMode = !isCorrectionMode;
        setIsCorrectionMode(newMode);

        if (newMode) {
            // Populate with current values
            const currentVals = {};
            items.forEach(i => {
                currentVals[`${i.item_name}:::${i.office_location}`] = i.quantity;
            });
            setMatrixValues(currentVals);
        } else {
            // Clear for Add Mode
            setMatrixValues({});
        }
    };

    const handleMatrixChange = (itemName, officeName, value) => {
        const key = `${itemName}:::${officeName}`;
        setMatrixValues(prev => ({ ...prev, [key]: value }));
    };

    const handleAddMatrixRow = () => {
        if (matrixNewItemName.trim()) {
            setCustomRowNames(prev => [...prev, matrixNewItemName.trim()]);
            setMatrixNewItemName('');
        }
    };

    const handleMatrixSubmit = async (e) => {
        e.preventDefault();
        try {
            const updatesMap = {};

            // Helper to ensure entry exists
            const getEntry = (itemName, officeName) => {
                const key = `${itemName}:::${officeName}`;
                if (!updatesMap[key]) {
                    // Try to preserve existing category
                    const existingItem = items.find(i => i.item_name === itemName);
                    const category = existingItem ? existingItem.category : 'Hardware';

                    updatesMap[key] = {
                        item_name: itemName,
                        category: category,
                        office_location: officeName,
                        quantity: 0
                    };
                }
                return updatesMap[key];
            };

            // 1. Process Quantities
            Object.entries(matrixValues).forEach(([key, value]) => {
                const inputQty = parseInt(value);
                if (isNaN(inputQty)) return;

                const [itemName, officeName] = key.split(':::');
                const entry = getEntry(itemName, officeName);

                if (isCorrectionMode) {
                    // Calculate Difference (Delta)
                    // We want final stock to be Input. 
                    // Backend does increment. 
                    // So we send (Input - Current).
                    const existingItem = items.find(i => i.item_name === itemName && i.office_location === officeName);
                    const currentQty = existingItem ? existingItem.quantity : 0;
                    entry.quantity = inputQty - currentQty;
                } else {
                    entry.quantity = inputQty;
                }
            });

            // 2. Process Thresholds (Apply to ALL offices for that item)
            Object.entries(matrixThresholds).forEach(([itemName, limit]) => {
                const threshold = parseInt(limit);
                if (isNaN(threshold)) return;

                offices.forEach(office => {
                    const entry = getEntry(itemName, office.name);
                    entry.min_threshold = threshold;
                });
            });

            // 3. Process New Items with 0 Quantity (Ensure they get created)
            customRowNames.forEach(newItemName => {
                // If this new item wasn't touched in the matrixValues (i.e. no quantity entered), it won't be in updatesMap yet.
                // We need to ensure at least one entry exists to trigger creation.
                // Check if it's already in updatesMap
                const alreadyQueued = Object.values(updatesMap).some(u => u.item_name === newItemName);

                if (!alreadyQueued) {
                    // Force create it in the first available office with 0 quantity
                    const defaultOffice = offices.length > 0 ? offices[0].name : 'Headquarters';
                    const key = `${newItemName}:::${defaultOffice}`;
                    updatesMap[key] = {
                        item_name: newItemName,
                        category: 'Hardware', // Default
                        office_location: defaultOffice,
                        quantity: 0
                    };
                }
            });

            const payload = Object.values(updatesMap); // Send all, even 0 qty if it's a new item or forced update

            if (payload.length > 0) {
                await api.bulkInventoryUpdate(payload);
                alert(isCorrectionMode ? `✅ Corrections Applied` : `✅ Stock Added Successfully`);
            }

            setShowAddModal(false);
            setMatrixValues({});
            setMatrixThresholds({});
            setCustomRowNames([]);
            setIsCorrectionMode(false);
            fetchItems();
        } catch (e) {
            console.error('Matrix Update Error:', e);
            alert("Failed to process updates.");
        }
    };

    // Legacy handleAdd kept for safety but unused in new UI
    const handleAddItem = async (e) => { e.preventDefault(); };

    const handleUpdateThreshold = async (e) => {
        e.preventDefault();
        try {
            await api.updateInventoryItem(showEditThresholdModal.id, { min_threshold: showEditThresholdModal.min_threshold });
            setShowEditThresholdModal(null);
            fetchItems();
        } catch (e) {
            console.error('Update Threshold Error:', e);
        }
    };

    const handleTransaction = async (e, type) => {
        e.preventDefault();
        const item = type === 'RESTOCK' ? showRestockModal : showIssueModal;
        if (!item) return;

        try {
            const qty = parseInt(transactionAmount);
            const change = type === 'RESTOCK' ? qty : -qty;
            const newQty = (item.quantity || 0) + change;

            if (newQty < 0) {
                alert("Error: Cannot reduce stock below 0");
                return;
            }

            await api.updateInventoryItem(item.id, { quantity: newQty });
            await logTransaction(item, change, type, transactionReason);

            setShowRestockModal(null);
            setShowIssueModal(null);
            setTransactionAmount(1);
            setTransactionReason('');
            fetchItems();
        } catch (e) {
            console.error('Transaction Error:', e);
        }
    };

    // PIN Protected Delete
    const initiateDeleteItem = (id, itemName, isGlobalDelete = false) => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before deleting inventory items.\n\nPlease go to Settings > Security (Firewall) and set a PIN first.');
            navigate('/dashboard/settings');
            return;
        }

        setPendingAction({
            type: isGlobalDelete ? 'DELETE_ITEM_GLOBAL' : 'DELETE_ITEM',
            payload: { id, name: itemName }
        });
        setShowPinModal(true);
    };

    const verifyAndExecute = async () => {
        if (!pinInput) return;

        try {
            const response = await api.verifyPin(pinInput);
            if (response.valid) {
                setShowPinModal(false);
                setPinInput('');

                if (pendingAction?.type === 'DELETE_ITEM') {
                    await executeDeleteItem(pendingAction.payload.id, pinInput);
                } else if (pendingAction?.type === 'DELETE_ITEM_GLOBAL') {
                    // Find ALL items with this name
                    const nameToDelete = pendingAction.payload.name;
                    const targets = items.filter(i => i.item_name === nameToDelete);
                    let successCount = 0;

                    for (const target of targets) {
                        try {
                            await api.deleteInventoryItem(target.id, pinInput);
                            successCount++;
                        } catch (e) { console.error("Failed to delete variant", target.id); }
                    }

                    if (successCount > 0) {
                        fetchItems();
                        alert(`✅ Deleted ${successCount} record(s) for "${nameToDelete}"`);
                    }
                } else if (pendingAction?.type === 'BULK_DELETE_ITEMS') {
                    const itemsToDelete = Array.from(pendingAction.payload); // Set of strings (item names)
                    let totalDeleted = 0;

                    // Group by Name to find ID variants
                    for (const name of itemsToDelete) {
                        const variants = items.filter(i => i.item_name === name);
                        for (const v of variants) {
                            try {
                                await api.deleteInventoryItem(v.id, pinInput);
                                totalDeleted++;
                            } catch (e) { console.error(`Failed to delete ${name}`, e); }
                        }
                    }

                    if (totalDeleted > 0) {
                        fetchItems();
                        setSelectedItems(new Set());
                        alert(`✅ Bulk Deleted ${totalDeleted} records.`);
                    } else {
                        alert("No records deleted. Check PIN or permissions.");
                    }
                }

                setPendingAction(null);
            }
        } catch (e) {
            alert('❌ Incorrect PIN!');
            setPinInput('');
        }
    };

    const executeDeleteItem = async (id, securityPin) => {
        try {
            await api.deleteInventoryItem(id, securityPin);
            fetchItems();
            alert('✅ Item deleted successfully!');
        } catch (e) {
            console.error('Delete Item Error:', e);
            alert("Failed to delete item.");
        }
    };

    // Legacy function names for button clicks not yet updated
    const handleDeleteItem = (id) => {
        const item = items.find(i => i.id === id);
        initiateDeleteItem(id, item ? item.item_name : 'Item');
    };

    const fetchItemHistory = async (item) => {
        setLoadingLogs(true);
        setShowHistoryModal(item);
        try {
            const logs = await api.getInventoryLogs();
            const historical = logs.filter(l =>
                (l.itemId === item.id) ||
                (l.itemName === item.item_name && l.office === item.office_location)
            ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setItemLogs(historical);
        } catch (err) {
            console.error("History Fetch Error:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    // --- IMPORT CSV FUNCTION ---
    const handleDownloadTemplate = () => {
        const header = "Item Name,Category,Office,Quantity";
        const example = "Dell Monitor,Hardware,HYD,10\nLogitech Mouse,Peripheral,AMD,5";
        downloadCSV(`${header}\n${example}`, "inventory_import_template.csv");
    };

    const handleImportCSV = async (e) => {
        // ... existing handleImportCSV content ... (I should not overwrite it, just insert before)
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            // Simple Parse: Assumes header present. Split by newline.
            const rows = text.split('\n').slice(1);
            let count = 0;

            for (const row of rows) {
                if (!row.trim()) continue;
                // CSV Format: Name, Category, Office, Quantity
                // Handle basic CSV (no commas involved in names for now)
                const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length < 4) continue;

                const [name, cat, office, qtyStr] = cols;
                const qty = parseInt(qtyStr) || 0;

                try {
                    const docData = { item_name: name, category: cat, office_location: office, quantity: qty };
                    const item = await api.createInventoryItem(docData);
                    if (qty > 0) {
                        await logTransaction(item, qty, 'INITIAL', 'Bulk Import');
                    }
                    count++;
                } catch (err) {
                    console.error("Row import failed", row, err);
                }
            }
            alert(`Successfully imported ${count} items.`);
            fetchItems();
        };
        reader.readAsText(file);
    };

    const handlePreviewStockReport = async () => {
        try {
            const startStr = `${reportDate.year}-${String(reportDate.month + 1).padStart(2, '0')}-01`;
            const startDate = new Date(startStr);
            const endDate = new Date(reportDate.year, reportDate.month + 1, 0, 23, 59, 59);

            const logs = await api.getInventoryLogs();

            // Consolidate data if "All" is selected
            let targetItems = [];
            if (activeOffice === 'All') {
                const uniqueNames = [...new Set(items.map(i => i.item_name))];
                targetItems = uniqueNames.map(name => {
                    const variants = items.filter(i => i.item_name === name);
                    return {
                        item_name: name,
                        category: variants[0].category,
                        office_location: 'Total (All Offices)',
                        ids: variants.map(v => v.id)
                    };
                });
            } else {
                targetItems = items
                    .filter(i => i.office_location === activeOffice)
                    .map(i => ({ ...i, ids: [i.id] }));
            }

            const headers = ["Item Name", "Category", "Office", "Opening", "In", "Out", "Closing", "Last Action"];
            const rows = targetItems.map(target => {
                const itemLogs = logs.filter(l =>
                    target.ids.includes(l.itemId) ||
                    (activeOffice === 'All' && l.itemName === target.item_name)
                );

                const previousLogs = itemLogs.filter(l => new Date(l.timestamp) < startDate);
                const periodLogs = itemLogs.filter(l => {
                    const d = new Date(l.timestamp);
                    return d >= startDate && d <= endDate;
                });

                const openingStock = previousLogs.reduce((sum, l) => sum + (parseInt(l.change) || 0), 0);
                const added = periodLogs.filter(l => l.change > 0).reduce((sum, l) => sum + l.change, 0);
                const consumed = periodLogs.filter(l => l.change < 0).reduce((sum, l) => sum + Math.abs(l.change), 0);
                const closingStock = openingStock + added - consumed;

                const lastLog = periodLogs.length > 0 ? periodLogs[periodLogs.length - 1] : null;
                const lastUpdatedInfo = lastLog
                    ? `${lastLog.performedBy || 'System'} (${new Date(lastLog.timestamp).toLocaleDateString()})`
                    : '-';

                return [target.item_name, target.category, target.office_location, openingStock, added, consumed, closingStock, lastUpdatedInfo];
            });

            setReportPreview({
                title: `Stock Status Report - ${activeOffice} (${startDate.toLocaleString('default', { month: 'long', year: 'numeric' })})`,
                headers,
                rows,
                filename: `Stock_Status_${activeOffice}_${reportDate.year}_${reportDate.month + 1}.csv`
            });
        } catch (err) {
            console.error("Export Error:", err);
            alert("Failed to generate report");
        }
    };

    // --- CLAIM / USAGE REPORT ---
    const handlePreviewClaimsReport = async () => {
        try {
            const startStr = `${reportDate.year}-${String(reportDate.month + 1).padStart(2, '0')}-01`;
            const startDate = new Date(startStr);
            const endDate = new Date(reportDate.year, reportDate.month + 1, 0, 23, 59, 59);

            const allLogs = await api.getInventoryLogs();
            const claimLogs = allLogs.filter(l => {
                const d = new Date(l.timestamp);
                return l.type === 'ISSUE' && d >= startDate && d <= endDate && (activeOffice === 'All' || l.office === activeOffice);
            });

            const headers = ["Date", "Item Name", "Office", "Qty", "Reason", "Claimed By", "Processed By"];
            const rows = claimLogs.map(l => {
                let claimedBy = '-';
                if (l.reason && l.reason.includes(' - ')) {
                    // Extract name from "Ticket ... - Name"
                    const parts = l.reason.split(' - ');
                    if (parts.length > 1) claimedBy = parts[parts.length - 1]; // Take the last part
                } else if (l.reason && l.reason.toLowerCase().includes('issued to ')) {
                    claimedBy = l.reason.substring(10);
                }

                return [
                    new Date(l.timestamp).toLocaleDateString(),
                    l.itemName,
                    l.office,
                    Math.abs(l.change),
                    l.reason,
                    claimedBy,
                    l.performedBy || 'Admin'
                ];
            });

            setReportPreview({
                title: `Claims Report - ${activeOffice} (${startDate.toLocaleString('default', { month: 'long', year: 'numeric' })})`,
                headers,
                rows,
                filename: `Claims_Report_${activeOffice}_${reportDate.year}_${reportDate.month + 1}.csv`
            });
        } catch (err) {
            console.error("Claim Export Error", err);
            alert("Failed to export claims");
        }
    };

    const downloadCSV = (content, filename) => {
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + content);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const filteredItems = items.filter(i => {
        const matchesOffice = activeOffice === 'All' || i.office_location === activeOffice;
        const matchesLowStock = !filterLowStock || i.quantity <= i.min_threshold;
        return matchesOffice && matchesLowStock;
    });

    const lowStockCount = items.filter(i => i.quantity <= i.min_threshold).length;

    return (
        <div className="relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Inventory Management</h2>
                    <p className="text-sm text-slate-400">Track assets and stock levels per office</p>
                </div>
            </div>

            {/* Controls & Filters */}
            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700/50 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Report Date Picker */}
                    <div className="flex items-center justify-between gap-2 bg-[#0f172a] p-2 rounded-lg border border-slate-700 w-full md:w-auto">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Report Period:</span>
                        <div className="flex gap-2">
                            <select
                                className="bg-[#1e293b] border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500"
                                value={reportDate.month}
                                onChange={e => setReportDate({ ...reportDate, month: parseInt(e.target.value) })}
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                                ))}
                            </select>
                            <select
                                className="bg-[#1e293b] border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500"
                                value={reportDate.year}
                                onChange={e => setReportDate({ ...reportDate, year: parseInt(e.target.value) })}
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
                        <button
                            onClick={handlePreviewStockReport}
                            className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 shadow-sm transition text-sm font-medium whitespace-nowrap"
                        >
                            <FileSpreadsheet size={16} /> Stock Report
                        </button>
                        <button
                            onClick={handlePreviewClaimsReport}
                            className="flex-1 md:flex-none bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-700 shadow-sm transition text-sm font-medium whitespace-nowrap"
                        >
                            <Download size={16} /> Claims Report
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm text-sm font-medium whitespace-nowrap"
                        >
                            <Plus size={16} /> Add Item
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Bulk Actions */}
                    {selectedItems.size > 0 && ['Admin', 'Super Admin'].includes(adminUser?.role) && (
                        <button
                            onClick={() => {
                                setPendingAction({ type: 'BULK_DELETE_ITEMS', payload: selectedItems });
                                setShowPinModal(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-red-700 animate-in fade-in slide-in-from-right-2"
                        >
                            <Trash2 size={16} /> Delete {selectedItems.size} Selected
                        </button>
                    )}

                    <button
                        onClick={() => setFilterLowStock(!filterLowStock)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${filterLowStock
                            ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                            : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300'}`}
                    >
                        <Archive size={16} />
                        Low Stock {lowStockCount > 0 && <span className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{lowStockCount}</span>}
                    </button>
                </div>
            </div>

            {/* Main Matrix View - Updated 2026-01-09 16:22 */}
            <div className="bg-[#1e293b] rounded-2xl shadow-sm border border-slate-700/50 overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-[#334155] text-slate-300 text-sm font-bold uppercase tracking-wide">
                        <tr>
                            <th className="py-3 px-4 w-10 border-b border-slate-600 bg-[#334155] sticky left-0 z-30">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500 transition cursor-pointer"
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            const allNames = Array.from(new Set(items.map(i => i.item_name)));
                                            setSelectedItems(new Set(allNames));
                                        } else {
                                            setSelectedItems(new Set());
                                        }
                                    }}
                                    checked={selectedItems.size > 0 && selectedItems.size === new Set(items.map(i => i.item_name)).size}
                                />
                            </th>
                            <th className="py-3 px-4 border-b border-slate-600 sticky left-0 bg-[#334155] z-20 w-48 min-w-[12rem] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">Item Name</th>
                            {offices.map(off => (
                                <th key={off.id} className="py-3 px-4 border-b border-slate-600 text-center min-w-[85px]">{off.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {
                            // Get Unique Item Names
                            Array.from(new Set(items.map(i => i.item_name)))
                                .sort((a, b) => {
                                    const indexA = PREDEFINED_ORDER.indexOf(a);
                                    const indexB = PREDEFINED_ORDER.indexOf(b);
                                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                    if (indexA !== -1) return -1;
                                    if (indexB !== -1) return 1;
                                    return a.localeCompare(b);
                                })
                                .map(itemName => {
                                    return (
                                        <tr key={itemName} className={`border-b border-slate-700/50 hover:bg-[#1e293b] transition duration-150 ${selectedItems.has(itemName) ? 'bg-blue-900/10' : ''}`}>
                                            <td className="p-4 bg-[#1e293b] border-r border-slate-700/50 sticky left-0 z-20 w-10">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500 transition cursor-pointer"
                                                    checked={selectedItems.has(itemName)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedItems);
                                                        if (e.target.checked) newSet.add(itemName);
                                                        else newSet.delete(itemName);
                                                        setSelectedItems(newSet);
                                                    }}
                                                />
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-200 bg-[#1e293b] border-r border-slate-700/50 sticky left-0 z-20 w-48 min-w-[12rem] max-w-[12rem] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] group-hover:bg-[#0f172a]">
                                                <div className="flex items-center justify-between group h-full w-full">
                                                    <span className="truncate pr-2" title={itemName}>{itemName}</span>
                                                    {['Admin', 'Super Admin'].includes(adminUser?.role) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const itemsToDelete = items.filter(i => i.item_name === itemName);
                                                                if (itemsToDelete.length === 0) return;
                                                                initiateDeleteItem(itemsToDelete[0].id, itemName, true);
                                                            }}
                                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-md opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                                            title="Delete this Item"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            {offices.map(off => {
                                                const itemData = items.find(i => i.item_name === itemName && i.office_location === off.name);
                                                const qty = itemData ? itemData.quantity : 0;

                                                // Color logic: Updated for Dark Theme
                                                let colorClass = 'text-slate-500'; // Default (0)
                                                if (qty >= 7) {
                                                    colorClass = 'bg-green-900/30 text-green-400 border border-green-500/20';
                                                } else if (qty >= 5) {
                                                    colorClass = 'bg-purple-900/30 text-purple-400 border border-purple-500/20';
                                                } else if (qty >= 1) {
                                                    colorClass = 'bg-orange-900/30 text-orange-400 border border-orange-500/20';
                                                } else {
                                                    colorClass = 'bg-red-900/30 text-red-500 border border-red-500/20';
                                                }

                                                return (
                                                    <td key={off.id} className="py-3 px-4 text-center border-r border-slate-700/50 last:border-0">
                                                        <span className={`inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-lg font-semibold text-sm ${colorClass}`}>
                                                            {qty}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                        }
                        {items.length === 0 && (
                            <tr><td colSpan={offices.length + 1} className="p-12 text-center text-slate-500">No inventory items found. Add some!</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* PIN Verification Modal */}
            {showPinModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 border border-slate-700">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mb-3">
                                <Shield size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Security Check</h3>
                            <p className="text-sm text-slate-400 mt-1">
                                {pendingAction?.type === 'DELETE_ITEM'
                                    ? `⚠️ Delete item "${pendingAction.payload.name}"? Enter PIN to confirm.`
                                    : pendingAction?.type === 'DELETE_ITEM_GLOBAL'
                                        ? `⚠️ Delete ALL variants of "${pendingAction.payload.name}"? Enter PIN to confirm.`
                                        : 'Enter your admin PIN to proceed.'}
                            </p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); verifyAndExecute(); }}>
                            <input
                                type="password"
                                className="w-full text-center text-2xl tracking-widest font-bold border-2 border-slate-600 rounded-xl p-3 bg-[#0f172a] text-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-900/20 transition-all outline-none"
                                placeholder="Enter PIN"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                autoFocus
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
            )}
            {/* Add / Bulk Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <form onSubmit={handleMatrixSubmit} className="bg-[#1e293b] rounded-2xl w-full max-w-7xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-700">
                            <div className="flex justify-between items-center p-6 border-b border-slate-700">
                                <div>
                                    <h3 className="text-xl font-bold text-white">
                                        {isCorrectionMode ? 'Correct Stock Levels' : 'Add New Stock'}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        {isCorrectionMode
                                            ? 'Enter the ACTUAL total quantity to override existing stock.'
                                            : 'Enter the NEW quantity arriving. It will be added to existing stock.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-amber-900/30 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-900/50 transition select-none">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500 cursor-pointer bg-slate-800 border-slate-600"
                                            checked={isCorrectionMode}
                                            onChange={toggleCorrectionMode}
                                        />
                                        <span className="text-sm font-bold text-amber-500">Correction Mode</span>
                                    </label>
                                    <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-700 rounded-full text-slate-400"><X size={20} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#0f172a] sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 text-sm font-bold text-slate-300 border-b border-slate-700 bg-[#0f172a] min-w-[200px]">Item Name</th>
                                            <th className="p-3 text-sm font-bold text-slate-300 border-b border-slate-700 bg-[#0f172a] w-[100px] text-center">Alert Limit</th>
                                            {offices.map(off => (
                                                <th key={off.id} className="p-3 text-sm font-bold text-slate-300 border-b border-slate-700 bg-[#0f172a] text-center min-w-[100px]">{off.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {/* Combine existing items and custom row names */}
                                        {Array.from(new Set([...items.map(i => i.item_name), ...customRowNames]))
                                            .sort((a, b) => {
                                                const indexA = PREDEFINED_ORDER.indexOf(a);
                                                const indexB = PREDEFINED_ORDER.indexOf(b);
                                                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                if (indexA !== -1) return -1;
                                                if (indexB !== -1) return 1;
                                                return a.localeCompare(b);
                                            })
                                            .map((itemName) => {
                                                // Find existing threshold for this item (from any office occurrence, or default 5)
                                                const existingItem = items.find(i => i.item_name === itemName);
                                                const currentThreshold = existingItem ? existingItem.min_threshold : 5;

                                                return (
                                                    <tr key={itemName} className="hover:bg-slate-800/50 transition">
                                                        <td className="p-3 font-semibold text-slate-200 border-r border-slate-700/50 bg-[#1e293b]">
                                                            {itemName}
                                                        </td>
                                                        <td className="p-2 border-r border-slate-700/50 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder={currentThreshold}
                                                                className="w-16 p-1 text-center bg-[#0f172a] border border-slate-600 rounded text-xs text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none"
                                                                value={matrixThresholds[itemName] || ''}
                                                                onChange={e => setMatrixThresholds({ ...matrixThresholds, [itemName]: e.target.value })}
                                                                title={`Current Alert Limit: ${currentThreshold}`}
                                                            />
                                                        </td>
                                                        {offices.map(off => (
                                                            <td key={off.id} className="p-2 border-r border-slate-700/50 text-center">
                                                                <input
                                                                    type="number"
                                                                    placeholder="-"
                                                                    className={`w-full p-2 text-center rounded-lg border focus:ring-2 focus:ring-cyan-500 outline-none transition text-white ${matrixValues[`${itemName}:::${off.name}`] ? 'bg-cyan-900/30 border-cyan-500 font-bold text-cyan-400' : 'bg-transparent border-transparent hover:border-slate-600 hover:bg-[#0f172a]'}`}
                                                                    value={matrixValues[`${itemName}:::${off.name}`] || ''}
                                                                    onChange={e => handleMatrixChange(itemName, off.name, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}

                                        {/* Add New Item Row */}
                                        <tr className="bg-[#0f172a]">
                                            <td className="p-3 border-r border-slate-700/50">
                                                <div className="flex gap-2">
                                                    <input
                                                        placeholder="Add New Item..."
                                                        className="w-full p-2 text-sm bg-[#1e293b] text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                                                        value={matrixNewItemName}
                                                        onChange={e => setMatrixNewItemName(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddMatrixRow())}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddMatrixRow}
                                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
                                                        disabled={!matrixNewItemName.trim()}
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-2 border-r border-slate-700/50 bg-[#0f172a]"></td>
                                            {offices.map(off => (
                                                <td key={off.id} className="p-2 border-r border-slate-700/50 bg-[#0f172a]"></td>
                                            ))}
                                        </tr>

                                    </tbody>
                                </table>


                            </div>

                            <div className="p-6 border-t border-slate-700 bg-[#0f172a] flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-400 hover:text-white font-medium">Cancel</button>
                                <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl transition flex items-center gap-2">
                                    <Archive size={18} /> Save Updates
                                </button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* Restock/Add Stock Modal */}
            {
                showRestockModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <form onSubmit={(e) => handleTransaction(e, 'RESTOCK')} className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                            <h3 className="text-xl font-bold mb-4 text-green-700 flex items-center gap-2"><Plus size={24} /> Add Stock</h3>
                            <p className="text-gray-600 mb-4 font-medium">{showRestockModal.item_name} <span className="text-gray-400 text-sm">({showRestockModal.office_location})</span></p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity to Add</label>
                                    <input
                                        type="number" min="1" className="w-full p-3 border border-gray-200 rounded-xl font-bold text-lg text-green-600"
                                        value={transactionAmount} onChange={e => setTransactionAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason / PO #</label>
                                    <input
                                        type="text" className="w-full p-3 border border-gray-200 rounded-xl text-sm"
                                        placeholder="e.g. Purchase Order 123"
                                        value={transactionReason} onChange={e => setTransactionReason(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowRestockModal(null)} className="px-4 py-2 text-gray-500 font-medium">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg">Confirm Add</button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* Issue/Consume Stock Modal */}
            {
                showIssueModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <form onSubmit={(e) => handleTransaction(e, 'ISSUE')} className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                            <h3 className="text-xl font-bold mb-4 text-amber-600 flex items-center gap-2"><MinusCircle size={24} /> Issue / Consume</h3>
                            <p className="text-gray-600 mb-4 font-medium">{showIssueModal.item_name} <span className="text-gray-400 text-sm">({showIssueModal.office_location})</span></p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity to Remove</label>
                                    <input
                                        type="number" min="1" className="w-full p-3 border border-gray-200 rounded-xl font-bold text-lg text-amber-600"
                                        value={transactionAmount} onChange={e => setTransactionAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason / User</label>
                                    <input
                                        type="text" className="w-full p-3 border border-gray-200 rounded-xl text-sm"
                                        placeholder="e.g. Issued to John Doe"
                                        value={transactionReason} onChange={e => setTransactionReason(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowIssueModal(null)} className="px-4 py-2 text-gray-500 font-medium">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 shadow-lg">Confirm Issue</button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* Report Preview Modal */}
            {
                reportPreview && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                        <div className="bg-[#1e293b] rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 border border-slate-700">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 flex justify-between items-center text-white border-b border-slate-700">
                                <div>
                                    <h3 className="text-xl font-bold">{reportPreview.title}</h3>
                                    <p className="text-slate-400 text-sm mt-1">Review the data below before downloading</p>
                                </div>
                                <button
                                    onClick={() => setReportPreview(null)}
                                    className="p-2 hover:bg-white/10 rounded-full transition"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-auto p-6 bg-[#0f172a]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#1e293b] sticky top-0">
                                        <tr>
                                            {reportPreview.headers.map((h, i) => (
                                                <th key={i} className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {reportPreview.rows.map((row, ri) => (
                                            <tr key={ri} className="hover:bg-[#1e293b] transition border-b border-slate-800 last:border-0">
                                                {row.map((cell, ci) => {
                                                    let cellStyle = "p-4 text-sm text-slate-400";
                                                    let content = cell;

                                                    // Special styling for quantity columns
                                                    if (ci === 4 && typeof cell === 'number' && cell > 0) { // IN
                                                        content = <span className="text-green-400 font-bold">+{cell}</span>;
                                                    } else if (ci === 5 && typeof cell === 'number' && cell > 0) { // OUT
                                                        content = <span className="text-orange-400 font-bold">-{cell}</span>;
                                                    } else if (ci === 6 && typeof cell === 'number') { // CLOSING
                                                        content = <span className={`font-black ${cell === 0 ? 'text-red-400' : 'text-white'}`}>{cell}</span>;
                                                    } else if (ci === 0) { // ITEM NAME
                                                        cellStyle = "p-4 text-sm font-bold text-white";
                                                    } else if (ci === 7) { // LAST ACTION
                                                        cellStyle = "p-4 text-[11px] text-slate-500 italic";
                                                    }

                                                    return (
                                                        <td key={ci} className={cellStyle}>
                                                            {content}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        {reportPreview.rows.length === 0 && (
                                            <tr>
                                                <td colSpan={reportPreview.headers.length} className="p-20 text-center text-slate-500">
                                                    No data found for this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-[#1e293b] border-t border-slate-700 flex justify-end gap-3">
                                <button
                                    onClick={() => setReportPreview(null)}
                                    className="px-6 py-2.5 text-slate-300 font-semibold hover:bg-slate-700 rounded-xl transition border border-slate-600"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        const csvData = [
                                            reportPreview.headers.join(","),
                                            ...reportPreview.rows.map(r => r.map(cell => `"${cell}"`).join(","))
                                        ].join("\n");
                                        downloadCSV(csvData, reportPreview.filename);
                                    }}
                                    className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg flex items-center gap-2 transition"
                                >
                                    <Download size={18} /> Download CSV
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Threshold Modal */}
            {
                showEditThresholdModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <form onSubmit={handleUpdateThreshold} className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700">
                            <h3 className="text-xl font-bold mb-4 text-white">Set Stock Alert Level</h3>
                            <p className="text-sm text-slate-400 mb-4">Warn me when <strong>{showEditThresholdModal.item_name}</strong> quantity reaches this level or lower.</p>

                            <div className="flex items-center gap-4 bg-[#0f172a] p-4 rounded-xl border border-slate-700">
                                <Archive className="text-red-500" size={32} />
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Threshold</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 text-2xl font-black bg-transparent border-b-2 border-blue-500 outline-none text-white"
                                        value={showEditThresholdModal.min_threshold}
                                        onChange={e => setShowEditThresholdModal({ ...showEditThresholdModal, min_threshold: parseInt(e.target.value) })}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowEditThresholdModal(null)} className="px-4 py-2 text-slate-400 font-medium hover:text-white">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg transition">Save Settings</button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* History Modal */}
            {
                showHistoryModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
                        <div className="bg-[#1e293b] rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500 border border-slate-700">
                            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#1e293b]">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
                                        <History size={24} />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-black text-white leading-tight">Transaction History</h3>
                                        <p className="text-slate-400 text-sm font-medium">{showHistoryModal.item_name} • <span className="text-blue-400 font-bold">{showHistoryModal.office_location}</span></p>
                                    </div>
                                </div>
                                <button onClick={() => setShowHistoryModal(null)} className="p-2.5 hover:bg-slate-700 rounded-full transition text-slate-400 group">
                                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto bg-[#0f172a]">
                                {loadingLogs ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-slate-400 font-medium">Loading history...</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-[#1e293b] sticky top-0 border-b border-slate-700">
                                            <tr>
                                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Change</th>
                                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Reason</th>
                                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Performed By</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {itemLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-[#1e293b] transition duration-300">
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-200">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                            <span className="text-[10px] text-slate-500 font-medium uppercase">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${log.type === 'RESTOCK' ? 'bg-green-900/30 text-green-400 border border-green-500/20' :
                                                            log.type === 'INITIAL' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/20' :
                                                                'bg-amber-900/30 text-amber-400 border border-amber-500/20'
                                                            }`}>
                                                            {log.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-black">
                                                        <span className={log.change > 0 ? 'text-green-500' : 'text-red-500'}>
                                                            {log.change > 0 ? '+' : ''}{log.change}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm text-slate-400 italic font-medium">"{log.reason || 'N/A'}"</td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-sm font-black text-slate-300">{log.performedBy || 'Admin'}</span>
                                                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                                {(log.performedBy || 'A').charAt(0)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {itemLogs.length === 0 && (
                                                <tr><td colSpan="5" className="p-20 text-center text-slate-500 font-medium">No transaction history available.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="p-4 bg-[#1e293b] border-t border-slate-700 flex justify-end">
                                <button onClick={() => setShowHistoryModal(null)} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:shadow-xl hover:bg-blue-700 transition-all duration-300 active:scale-95">Close History</button>
                            </div>
                        </div>
                    </div>
                )
            }


        </div >
    );
};

export default DashboardInventory;
