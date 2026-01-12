import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from './contexts/ConfigContext';
import LandingPage from './pages/LandingPage';
import AdminDetails from './pages/AdminLogin'; // Renamed to ensure uniqueness
import AdminDashboard from './pages/AdminDashboard';
import TicketSubmission from './pages/TicketSubmission';
import OneDriveCallback from './pages/OneDriveCallback';
import TicketTracker from './pages/TicketTracker';
import Layout from './components/Layout';
import SetupPage from './pages/SetupPage';
import api from './lib/api';

const ProtectedRoute = ({ children }) => {
    return api.isAuthenticated() ? children : <Navigate to="/admin" />;
};

function App() {
    return (
        <ConfigProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/submit-ticket" element={<TicketSubmission />} />
                    <Route path="/track/:id" element={<TicketTracker />} />
                    <Route path="/setup" element={<SetupPage />} />
                    <Route path="/admin" element={<AdminDetails />} />
                    <Route path="/onedrive-callback" element={<OneDriveCallback />} />

                    {/* Protected */}
                    <Route path="/dashboard/*" element={
                        <ProtectedRoute>
                            <Layout>
                                <AdminDashboard />
                            </Layout>
                        </ProtectedRoute>
                    } />
                </Routes>
            </Router>
        </ConfigProvider>
    );
}

export default App;
