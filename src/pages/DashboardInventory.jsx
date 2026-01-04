import { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { Plus, Archive, History, MinusCircle, FileSpreadsheet, Filter, Upload, Download } from 'lucide-react';

const DashboardInventory = () => {
    const [items, setItems] = useState([]);
    const [offices, setOffices] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);

    // Transaction Modals
    const [showRestockModal, setShowRestockModal] = useState(null); // Item object
    const [showIssueModal, setShowIssueModal] = useState(null); // Item object

    // Filter & Report States
    const [activeOffice, setActiveOffice] = useState('All');
    const [reportDate, setReportDate] = useState({
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    });

    // Forms
    const [newItem, setNewItem] = useState({ item_name: '', category: 'Hardware', office_location: '', quantity: 0 });
    const [transactionAmount, setTransactionAmount] = useState(1);
    const [transactionReason, setTransactionReason] = useState('');

    const fetchItems = async () => {
        try {
            const itemsList = await pb.collection('inventory').getFullList();
            setItems(itemsList);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchItems();
        pb.collection('offices').getFullList().then(officeList => {
            setOffices(officeList);
            if (officeList.length > 0) newItem.office_location || setNewItem(prev => ({ ...prev, office_location: officeList[0].name }));
        });
    }, []);

    // Helper to log transactions
    const logTransaction = async (item, change, type, reason) => {
        try {
            await pb.collection('inventory_logs').create({
                itemId: item.id || 'new',
                itemName: item.item_name || newItem.item_name,
                office: item.office_location || newItem.office_location,
                change: change,
                type: type, // 'INITIAL', 'RESTOCK', 'ISSUE'
                reason: reason || '',
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error("Failed to log transaction", err);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            const docRef = await pb.collection('inventory').create(newItem);
            // Log Initial Stock
            if (newItem.quantity > 0) {
                await logTransaction({ ...newItem, id: docRef.id }, newItem.quantity, 'INITIAL', 'Initial Stock');
            }
            setShowAddModal(false);
            setNewItem({ item_name: '', category: 'Hardware', office_location: offices[0]?.name || '', quantity: 0 });
            fetchItems();
        } catch (e) {
            console.error('Add Item Error:', e);
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

            await pb.collection('inventory').update(item.id, { quantity: newQty });
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
                    const docRef = await pb.collection('inventory').create(docData);
                    if (qty > 0) {
                        await logTransaction({ ...docData, id: docRef.id }, qty, 'INITIAL', 'Bulk Import');
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

    const handleExportReport = async () => {
        try {
            const startStr = `${reportDate.year}-${String(reportDate.month + 1).padStart(2, '0')}-01`;
            const startDate = new Date(startStr);
            const endDate = new Date(reportDate.year, reportDate.month + 1, 0, 23, 59, 59);

            // Fetch all logs and filter in memory (or use advanced filter if needed)
            const logs = await pb.collection('inventory_logs').getFullList({
                sort: '-timestamp',
                // filter: `timestamp >= "${startStr}"` // Optional optimization
            });
            const targetItems = activeOffice === 'All' ? items : items.filter(i => i.office_location === activeOffice);

            const reportRows = targetItems.map(item => {
                const itemLogs = logs.filter(l => l.itemId === item.id || l.itemName === item.item_name);
                const previousLogs = itemLogs.filter(l => new Date(l.timestamp) < startDate);
                const periodLogs = itemLogs.filter(l => { const d = new Date(l.timestamp); return d >= startDate && d <= endDate; });

                const openingStock = previousLogs.reduce((sum, l) => sum + (parseInt(l.change) || 0), 0);
                const added = periodLogs.filter(l => l.change > 0).reduce((sum, l) => sum + l.change, 0);
                const consumed = periodLogs.filter(l => l.change < 0).reduce((sum, l) => sum + Math.abs(l.change), 0);
                const closingStock = openingStock + added - consumed;

                return {
                    name: item.item_name, category: item.category, office: item.office_location,
                    opening: openingStock, added: added, consumed: consumed, closing: closingStock, current_db_stock: item.quantity
                };
            });

            const header = ["Item Name", "Category", "Office", "Opening Stock", "Added (In)", "Consumed (Out)", "Closing Stock", "Current System Qty"];
            const csvRows = [header.join(","), ...reportRows.map(r => [`"${r.name}"`, r.category, r.office, r.opening, r.added, r.consumed, r.closing, r.current_db_stock].join(","))];
            downloadCSV(csvRows.join("\n"), `Inventory_Report_${activeOffice}_${reportDate.year}_${reportDate.month + 1}.csv`);
        } catch (err) {
            console.error("Export Error:", err);
            alert("Failed to generate report");
        }
    };

    // --- CLAIM / USAGE REPORT ---
    const handleExportClaims = async () => {
        try {
            const logsSnapshot = await getDocs(collection(db, 'inventory_logs'));
            // Filter all 'ISSUE' type logs (Consumption)
            // Optional: Filter by month/year? User usually cares about "Who claimed what recently".
            // For now, let's export ALL claims, or use the same date filter.
            const startStr = `${reportDate.year}-${String(reportDate.month + 1).padStart(2, '0')}-01`;
            const startDate = new Date(startStr);
            const endDate = new Date(reportDate.year, reportDate.month + 1, 0, 23, 59, 59);

            const allLogs = await pb.collection('inventory_logs').getFullList();
            const claimLogs = allLogs.filter(l => {
                const d = new Date(l.timestamp);
                return l.type === 'ISSUE' && d >= startDate && d <= endDate && (activeOffice === 'All' || l.office === activeOffice);
            });

            const header = ["Date", "Item Name", "Office", "Qty Claimed", "Category", "User / Reason"];
            const csvRows = [header.join(",")];

            claimLogs.forEach(l => {
                // Find category from items list if possible
                const item = items.find(i => i.item_name === l.itemName) || {};
                const category = item.category || 'Unknown';
                const dateStr = new Date(l.timestamp).toLocaleDateString();

                csvRows.push([dateStr, `"${l.itemName}"`, l.office, Math.abs(l.change), category, `"${l.reason}"`].join(","));
            });

            downloadCSV(csvRows.join("\n"), `Claims_Report_${activeOffice}_${reportDate.year}_${reportDate.month + 1}.csv`);

        } catch (err) {
            console.error("Claim Export Error", err);
            alert("Failed to export claims");
        }
    }

    const downloadCSV = (content, filename) => {
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + content);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const filteredItems = activeOffice === 'All' ? items : items.filter(i => i.office_location === activeOffice);

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Inventory Management</h2>
                    <p className="text-sm text-gray-500">Track assets and stock levels per office</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleDownloadTemplate}
                        className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 border border-gray-200 text-sm font-medium"
                        title="Download CSV Template"
                    >
                        <FileSpreadsheet size={16} /> Template
                    </button>
                    <label className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 cursor-pointer shadow-sm border border-gray-200">
                        <Upload size={18} /> Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                    </label>
                    <button
                        onClick={handleExportReport}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-sm"
                    >
                        <FileSpreadsheet size={18} /> Stock Report
                    </button>
                    <button
                        onClick={handleExportClaims}
                        className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 shadow-sm"
                    >
                        <Download size={18} /> Claims Report
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm"
                    >
                        <Plus size={18} /> Add Item
                    </button>
                </div>
            </div>

            {/* Controls & Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                {/* Office Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                    <button
                        onClick={() => setActiveOffice('All')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeOffice === 'All' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        All Offices
                    </button>
                    {offices.map(off => (
                        <button
                            key={off.id}
                            onClick={() => setActiveOffice(off.name)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${activeOffice === off.name ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {off.name}
                        </button>
                    ))}
                </div>

                {/* Report Date Picker */}
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
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-sm">
                        <tr>
                            <th className="p-4">Item Name</th>
                            <th className="p-4">Category</th>
                            <th className="p-4">Office</th>
                            <th className="p-4 text-center">Stock Level</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredItems.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 transition">
                                <td className="p-4 font-medium text-gray-800">{item.item_name}</td>
                                <td className="p-4 text-gray-500 text-sm">{item.category}</td>
                                <td className="p-4"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold border border-blue-100">{item.office_location}</span></td>
                                <td className="p-4 text-center">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${item.quantity < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {item.quantity}
                                    </span>
                                </td>
                                <td className="p-4 flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowRestockModal(item)}
                                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                    >
                                        <Plus size={14} /> Add
                                    </button>
                                    <button
                                        onClick={() => setShowIssueModal(item)}
                                        className="bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                    >
                                        <MinusCircle size={14} /> Issue
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredItems.length === 0 && (
                            <tr><td colSpan="5" className="p-12 text-center text-gray-400">No items found for {activeOffice}.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleAddItem} className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Add New Inventory Item</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name</label>
                                <input
                                    placeholder="e.g. Dell Monitor 24in"
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    value={newItem.item_name} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                                    <select className="w-full p-3 border border-gray-200 rounded-xl" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                                        <option>Hardware</option>
                                        <option>Software</option>
                                        <option>Peripheral</option>
                                        <option>Furniture</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Office</label>
                                    <select className="w-full p-3 border border-gray-200 rounded-xl" value={newItem.office_location} onChange={e => setNewItem({ ...newItem, office_location: e.target.value })}>
                                        {offices.map(off => (
                                            <option key={off.id} value={off.name}>{off.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Initial Quantity</label>
                                <input
                                    type="number" className="w-full p-3 border border-gray-200 rounded-xl" placeholder="0"
                                    value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl transition">Create Item</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Restock/Add Stock Modal */}
            {showRestockModal && (
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
            )}

            {/* Issue/Consume Stock Modal */}
            {showIssueModal && (
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
            )}
        </div>
    );
};

export default DashboardInventory;
