import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Archive, History, MinusCircle, FileSpreadsheet, Filter, Upload, Download, Trash2, X, Search, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardInventory = () => {
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

            const payload = Object.values(updatesMap).filter(i => i.quantity !== 0 || i.min_threshold !== undefined);

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
    const initiateDeleteItem = (id, itemName) => {
        if (!pinStatus) {
            alert('⚠️ Security PIN Required!\n\nYou must set a security PIN before deleting inventory items.\n\nPlease go to Settings > Security (Firewall) and set a PIN first.');
            navigate('/dashboard/settings');
            return;
        }

        setPendingAction({ type: 'DELETE_ITEM', payload: { id, name: itemName } });
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
                    <h2 className="text-2xl font-bold text-gray-800">Inventory Management</h2>
                    <p className="text-sm text-gray-500">Track assets and stock levels per office</p>
                </div>
            </div>

            {/* Controls & Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Report Date Picker (Moved to First) */}
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report Period:</span>
                        <select
                            className="bg-white border rounded px-2 py-1 text-sm"
                            value={reportDate.month}
                            onChange={e => setReportDate({ ...reportDate, month: parseInt(e.target.value) })}
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                            ))}
                        </select>
                        <select
                            className="bg-white border rounded px-2 py-1 text-sm"
                            value={reportDate.year}
                            onChange={e => setReportDate({ ...reportDate, year: parseInt(e.target.value) })}
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handlePreviewStockReport}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-sm transition text-sm font-medium"
                    >
                        <FileSpreadsheet size={16} /> Stock Report
                    </button>
                    <button
                        onClick={handlePreviewClaimsReport}
                        className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 shadow-sm transition text-sm font-medium"
                    >
                        <Download size={16} /> Claims Report
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm text-sm font-medium"
                    >
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 text-sm font-semibold uppercase tracking-wide">
                        <tr>
                            <th className="py-3 px-4 border-b-2 border-gray-200 sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10 min-w-[140px]">Item Name</th>
                            {offices.map(off => (
                                <th key={off.id} className="py-3 px-4 border-b-2 border-gray-200 text-center min-w-[85px]">{off.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
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
                                    // Check if any variant of this item is low stock (for row highlighting? or just text?)
                                    // User said "simpal", so maybe just clean numbers.
                                    // I'll add a subtle red text if low.
                                    return (
                                        <tr key={itemName} className="hover:bg-gray-50 transition">
                                            <td className="py-3 px-4 font-medium text-gray-800 bg-gray-50/50 border-r border-gray-100 sticky left-0 z-10">
                                                {itemName}
                                            </td>
                                            {offices.map(off => {
                                                const itemData = items.find(i => i.item_name === itemName && i.office_location === off.name);
                                                const qty = itemData ? itemData.quantity : 0;

                                                // Color logic: 7+ Green, 5-6 Purple, 1-4 Orange, 0 Red
                                                let colorClass = 'text-gray-300'; // Default (0)
                                                if (qty >= 7) {
                                                    colorClass = 'bg-green-50 text-green-700 border border-green-200';
                                                } else if (qty >= 5) {
                                                    colorClass = 'bg-purple-50 text-purple-700 border border-purple-200';
                                                } else if (qty >= 1) {
                                                    colorClass = 'bg-orange-50 text-orange-700 border border-orange-200';
                                                } else {
                                                    colorClass = 'bg-red-50 text-red-600 border border-red-200';
                                                }

                                                return (
                                                    <td key={off.id} className="py-3 px-4 text-center border-r border-gray-100 last:border-0">
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
                            <tr><td colSpan={offices.length + 1} className="p-12 text-center text-gray-400">No inventory items found. Add some!</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add / Bulk Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <form onSubmit={handleMatrixSubmit} className="bg-white rounded-2xl w-full max-w-7xl shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">
                                        {isCorrectionMode ? 'Correct Stock Levels' : 'Add New Stock'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {isCorrectionMode
                                            ? 'Enter the ACTUAL total quantity to override existing stock.'
                                            : 'Enter the NEW quantity arriving. It will be added to existing stock.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition select-none">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                                            checked={isCorrectionMode}
                                            onChange={toggleCorrectionMode}
                                        />
                                        <span className="text-sm font-bold text-amber-700">Correction Mode</span>
                                    </label>
                                    <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 text-sm font-bold text-gray-700 border-b border-gray-200 bg-gray-50 min-w-[200px]">Item Name</th>
                                            <th className="p-3 text-sm font-bold text-gray-700 border-b border-gray-200 bg-gray-50 w-[100px] text-center">Alert Limit</th>
                                            {offices.map(off => (
                                                <th key={off.id} className="p-3 text-sm font-bold text-gray-700 border-b border-gray-200 bg-gray-50 text-center min-w-[100px]">{off.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
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
                                                    <tr key={itemName} className="hover:bg-blue-50/50 transition">
                                                        <td className="p-3 font-semibold text-gray-800 border-r border-gray-100 bg-gray-50/50">
                                                            {itemName}
                                                        </td>
                                                        <td className="p-2 border-r border-gray-50 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder={currentThreshold}
                                                                className="w-16 p-1 text-center bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                                value={matrixThresholds[itemName] || ''}
                                                                onChange={e => setMatrixThresholds({ ...matrixThresholds, [itemName]: e.target.value })}
                                                                title={`Current Alert Limit: ${currentThreshold}`}
                                                            />
                                                        </td>
                                                        {offices.map(off => (
                                                            <td key={off.id} className="p-2 border-r border-gray-50 text-center">
                                                                <input
                                                                    type="number"
                                                                    placeholder="-"
                                                                    className={`w-full p-2 text-center rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition ${matrixValues[`${itemName}:::${off.name}`] ? 'bg-blue-50 border-blue-200 font-bold text-blue-700' : 'bg-transparent border-transparent hover:border-gray-200'}`}
                                                                    value={matrixValues[`${itemName}:::${off.name}`] || ''}
                                                                    onChange={e => handleMatrixChange(itemName, off.name, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}

                                        {/* Add New Item Row */}
                                        <tr className="bg-gray-50">
                                            <td className="p-3 border-r border-gray-100">
                                                <div className="flex gap-2">
                                                    <input
                                                        placeholder="Add New Item..."
                                                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={matrixNewItemName}
                                                        onChange={e => setMatrixNewItemName(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddMatrixRow())}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddMatrixRow}
                                                        className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition"
                                                        disabled={!matrixNewItemName.trim()}
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-2 border-r border-gray-50 bg-gray-50"></td>
                                            {offices.map(off => (
                                                <td key={off.id} className="p-2 border-r border-gray-50 bg-gray-50"></td>
                                            ))}
                                        </tr>

                                    </tbody>
                                </table>


                            </div>

                            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
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
                        <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="text-xl font-bold">{reportPreview.title}</h3>
                                    <p className="text-gray-400 text-sm mt-1">Review the data below before downloading</p>
                                </div>
                                <button
                                    onClick={() => setReportPreview(null)}
                                    className="p-2 hover:bg-white/10 rounded-full transition"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-auto p-6">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            {reportPreview.headers.map((h, i) => (
                                                <th key={i} className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportPreview.rows.map((row, ri) => (
                                            <tr key={ri} className="hover:bg-gray-50 transition border-b border-gray-50 last:border-0">
                                                {row.map((cell, ci) => {
                                                    let cellStyle = "p-4 text-sm text-gray-600";
                                                    let content = cell;

                                                    // Special styling for quantity columns
                                                    if (ci === 4 && typeof cell === 'number' && cell > 0) { // IN
                                                        content = <span className="text-green-600 font-bold">+{cell}</span>;
                                                    } else if (ci === 5 && typeof cell === 'number' && cell > 0) { // OUT
                                                        content = <span className="text-orange-600 font-bold">-{cell}</span>;
                                                    } else if (ci === 6 && typeof cell === 'number') { // CLOSING
                                                        content = <span className={`font-black ${cell === 0 ? 'text-red-500' : 'text-gray-900'}`}>{cell}</span>;
                                                    } else if (ci === 0) { // ITEM NAME
                                                        cellStyle = "p-4 text-sm font-bold text-gray-900";
                                                    } else if (ci === 7) { // LAST ACTION
                                                        cellStyle = "p-4 text-[11px] text-gray-400 italic";
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
                                                <td colSpan={reportPreview.headers.length} className="p-20 text-center text-gray-400">
                                                    No data found for this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                                <button
                                    onClick={() => setReportPreview(null)}
                                    className="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition"
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
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <form onSubmit={handleUpdateThreshold} className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                            <h3 className="text-xl font-bold mb-4 text-gray-800">Set Stock Alert Level</h3>
                            <p className="text-sm text-gray-500 mb-4">Warn me when <strong>{showEditThresholdModal.item_name}</strong> quantity reaches this level or lower.</p>

                            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <Archive className="text-red-500" size={32} />
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Min Threshold</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 text-2xl font-black bg-transparent border-b-2 border-blue-500 outline-none"
                                        value={showEditThresholdModal.min_threshold}
                                        onChange={e => setShowEditThresholdModal({ ...showEditThresholdModal, min_threshold: parseInt(e.target.value) })}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowEditThresholdModal(null)} className="px-4 py-2 text-gray-500 font-medium hover:text-gray-700">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black shadow-lg">Save Settings</button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* History Modal */}
            {
                showHistoryModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
                        <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                                        <History size={24} />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-black text-gray-900 leading-tight">Transaction History</h3>
                                        <p className="text-gray-500 text-sm font-medium">{showHistoryModal.item_name} • <span className="text-blue-600 font-bold">{showHistoryModal.office_location}</span></p>
                                    </div>
                                </div>
                                <button onClick={() => setShowHistoryModal(null)} className="p-2.5 hover:bg-gray-200 rounded-full transition text-gray-400 group">
                                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto">
                                {loadingLogs ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-gray-400 font-medium">Loading history...</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-white sticky top-0 border-b">
                                            <tr>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Change</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Performed By</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {itemLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50/50 transition duration-300">
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-800">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                            <span className="text-[10px] text-gray-400 font-medium uppercase">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${log.type === 'RESTOCK' ? 'bg-green-100 text-green-700' :
                                                            log.type === 'INITIAL' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {log.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-black">
                                                        <span className={log.change > 0 ? 'text-green-600' : 'text-red-500'}>
                                                            {log.change > 0 ? '+' : ''}{log.change}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm text-gray-500 italic font-medium">"{log.reason || 'N/A'}"</td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-sm font-black text-gray-700">{log.performedBy || 'Admin'}</span>
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-[10px] font-black text-gray-400">
                                                                {(log.performedBy || 'A').charAt(0)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {itemLogs.length === 0 && (
                                                <tr><td colSpan="5" className="p-20 text-center text-gray-400 font-medium">No transaction history available.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 border-t flex justify-end">
                                <button onClick={() => setShowHistoryModal(null)} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:shadow-xl transition-all duration-300 active:scale-95">Close History</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* PIN Verification Modal */}
            {
                showPinModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                            <div className="text-center mb-6">
                                <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                    <Shield size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">Security Check</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {pendingAction?.type === 'DELETE_ITEM'
                                        ? `⚠️ Delete item "${pendingAction.payload.name}"? Enter PIN to confirm.`
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
                )
            }
        </div >
    );
};

export default DashboardInventory;
