import { createContext, useContext, useState, useEffect } from 'react';
import pb from '../lib/pocketbase';

const ConfigContext = createContext();

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({
        company_name: 'Support Portal',
        logo_url: '',
        primary_color: '#2563eb',
        background_url: ''
    });
    const [loading, setLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            // Fetch all settings from PocketBase 'settings' collection
            // Expecting collection 'settings' with fields: key, value
            const records = await pb.collection('settings').getFullList();

            const settingsMap = {};
            records.forEach(record => {
                // Assuming record.key holds the setting identifier (e.g. 'company_name')
                // and record.value holds the value.
                if (record.key && record.value) {
                    settingsMap[record.key] = record.value;
                }
            });

            if (Object.keys(settingsMap).length > 0) {
                setConfig(prev => ({ ...prev, ...settingsMap }));
            }
        } catch (err) {
            console.error("Failed to load config from PocketBase", err);
            // Fallback or just keep defaults
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return (
        <ConfigContext.Provider value={{ config, refreshConfig: fetchConfig, loading }}>
            {children}
        </ConfigContext.Provider>
    );
};
