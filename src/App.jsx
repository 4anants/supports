import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from './contexts/ConfigContext';
import LandingPage from './pages/LandingPage';
import AdminDetails from './pages/AdminLogin'; // Renamed to ensure uniqueness
import AdminDashboard from './pages/AdminDashboard';
import TicketSubmission from './pages/TicketSubmission';
import TicketTracker from './pages/TicketTracker';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/admin" />;
};

function App() {
    return (
        <ConfigProvider>
            <Router>
                <Routes>
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/submit-ticket" element={<TicketSubmission />} />
                    <Route path="/track/:id" element={<TicketTracker />} />
                    <Route path="/admin" element={<AdminDetails />} />

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
