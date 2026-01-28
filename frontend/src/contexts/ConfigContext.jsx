import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const ConfigContext = createContext();

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({
        company_name: 'IT Supports',
        logo_url: 'https://cdn-icons-png.flaticon.com/512/2920/2920195.png',
        primary_color: '#2563eb',
        background_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2000'
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
                // Normalize relative URLs to absolute URLs
                const baseUrl = api.baseUrl.replace('/api', '');
                if (settings.logo_url && settings.logo_url.startsWith('/')) {
                    settings.logo_url = `${baseUrl}${settings.logo_url}`;
                }
                if (settings.background_url && settings.background_url.startsWith('/')) {
                    settings.background_url = `${baseUrl}${settings.background_url}`;
                }
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
