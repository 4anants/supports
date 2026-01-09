import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

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
            // Verify Token validity if present
            if (api.getToken()) {
                try {
                    await api.getMe();
                } catch (e) {
                    console.warn("Invalid token detected during startup, logging out.");
                    api.logout();
                }
            }

            // Fetch settings from custom backend API
            const settings = await api.getSettings();

            if (Object.keys(settings).length > 0) {
                setConfig(prev => ({ ...prev, ...settings }));
            }
        } catch (err) {
            console.error("Failed to load config from API", err);
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
