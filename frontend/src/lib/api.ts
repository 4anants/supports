const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
    private token: string | null = null;

    constructor() {
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getToken() {
        return this.token;
    }

    get baseUrl() {
        return API_URL;
    }

    private async request(endpoint: string, options: RequestInit & { headers?: any, securityPin?: string } = {}) {
        const isFormData = options.body instanceof FormData;

        const headers: any = {
            ...options.headers
        };

        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        // Add Security PIN header if provided
        if (options.securityPin) {
            headers['x-security-pin'] = options.securityPin;
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers
            });

            const contentType = response.headers.get('content-type');
            const isJson = contentType && contentType.includes('application/json');

            if (!response.ok) {
                if (isJson) {
                    const error = await response.json();
                    throw new Error(error.error || error.message || `HTTP ${response.status}`);
                } else {
                    const text = await response.text();
                    throw new Error(`Server Error (${response.status}) at ${response.url}: ${text.substring(0, 100)}`);
                }
            }

            if (isJson) {
                return response.json();
            }
            return response.text();
        } catch (error: any) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // Generic Methods
    async get(endpoint: string) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint: string, body: any, options: RequestInit & { securityPin?: string } = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // Auth
    async login(email: string, password: string) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.setToken(data.token);
        return data;
    }

    async register(email: string, password: string, name?: string) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
        this.setToken(data.token);
        return data;
    }

    async getMe() {
        return this.request('/auth/me');
    }

    logout() {
        this.setToken(null);
    }

    // Users
    async getUsers() {
        return this.request('/users');
    }

    async createUser(userData: any, securityPin?: string) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData),
            securityPin
        });
    }

    async updateUser(id: string, userData: any, securityPin?: string) {
        return this.request(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(userData),
            securityPin
        });
    }

    async deleteUser(id: string, securityPin?: string) {
        return this.request(`/users/${id}`, {
            method: 'DELETE',
            securityPin
        });
    }

    // Tickets
    async getTickets(params?: { status?: string; search?: string }) {
        const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
        return this.request(`/tickets${query}`);
    }

    async getTicket(id: string) {
        return this.request(`/tickets/${id}`);
    }

    async getTicketByGeneratedId(generatedId: string) {
        const tickets = await this.getTickets({ search: generatedId });
        return tickets.find((t: any) => t.generated_id === generatedId) || null;
    }

    async trackTicket(generatedId: string) {
        return this.request(`/tickets/track/${generatedId}`);
    }

    async createTicket(ticketData: any) {
        let body;
        if (ticketData instanceof FormData) {
            body = ticketData;
        } else {
            body = JSON.stringify(ticketData);
        }

        return this.request('/tickets', {
            method: 'POST',
            body
        });
    }

    async updateTicket(id: string, ticketData: any) {
        return this.request(`/tickets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(ticketData)
        });
    }

    async deleteTicket(id: string, securityPin?: string) {
        return this.request(`/tickets/${id}`, { method: 'DELETE', securityPin });
    }

    // --- Inventory ---

    // --- Inventory ---
    async getInventory() {
        return this.request('/inventory');
    }

    async getInventoryLogs() {
        return this.request('/inventory/logs');
    }

    async createInventoryItem(data: any) {
        return this.request('/inventory', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateInventoryItem(id: string, data: any) {
        return this.request(`/inventory/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    async createInventoryLog(data: any) {
        return this.request('/inventory/logs', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async deleteInventoryItem(id: string, securityPin?: string) {
        return this.request(`/inventory/${id}`, { method: 'DELETE', securityPin });
    }

    async bulkInventoryUpdate(items: any[]) {
        return this.request('/inventory/bulk', {
            method: 'POST',
            body: JSON.stringify({ items })
        });
    }

    // Settings

    // Settings
    async getSettings() {
        return this.request('/settings');
    }

    async updateSetting(key: string, value: string, securityPin?: string) {
        return this.request('/settings', {
            method: 'POST',
            body: JSON.stringify({ key, value }),
            securityPin
        });
    }

    async verifyPin(pin: string) {
        return this.request('/settings/pin/verify', {
            method: 'POST',
            body: JSON.stringify({ pin })
        });
    }

    async getPinStatus() {
        return this.request('/settings/pin-status');
    }

    // Offices
    async getOffices() {
        return this.request('/offices');
    }

    async createOffice(name: string, securityPin?: string) {
        return this.request('/offices', {
            method: 'POST',
            body: JSON.stringify({ name }),
            securityPin
        });
    }

    async deleteOffice(id: string, securityPin?: string) {
        return this.request(`/offices/${id}`, { method: 'DELETE', securityPin });
    }

    // Departments
    async getDepartments() {
        return this.request('/departments');
    }

    async createDepartment(name: string, order?: number, securityPin?: string) {
        return this.request('/departments', {
            method: 'POST',
            body: JSON.stringify({ name, order }),
            securityPin
        });
    }

    async deleteDepartment(id: string, securityPin?: string) {
        return this.request(`/departments/${id}`, { method: 'DELETE', securityPin });
    }

    // Email
    async sendTestEmail(email: string) {
        return this.request('/email/test', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async verifyEmail() {
        return this.request('/email/verify');
    }

    async triggerBackup(securityPin?: string) {
        return this.request('/settings/backup', { method: 'POST', securityPin });
    }


    async getBackups() {
        return this.request('/settings/backups');
    }

    async resetData(securityPin: string | undefined) {
        return this.request('/settings/reset/data', {
            method: 'POST',
            securityPin
        });
    }

    async resetSite(securityPin: string | undefined) {
        return this.request('/settings/reset/site', {
            method: 'POST',
            securityPin
        });
    }

    async uploadFile(formData: FormData) {
        return this.request('/upload', {
            method: 'POST',
            body: formData
        });
    }

    // Helper: Check if authenticated
    isAuthenticated() {
        return !!this.token;
    }
}

export default new ApiClient();
