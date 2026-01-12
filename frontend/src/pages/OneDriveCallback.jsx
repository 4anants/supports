import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const OneDriveCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            // Send code to parent window
            if (window.opener) {
                window.opener.postMessage({ type: 'ONEDRIVE_CODE', code }, window.location.origin);
                window.close();
            } else {
                alert('Authentication successful, but the parent window was closed. Copy this code: ' + code);
            }
        } else {
            const error = searchParams.get('error_description') || 'Unknown Error';
            alert('OneDrive Auth Failed: ' + error);
        }
    }, [searchParams]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <h2 className="text-xl font-bold text-gray-800">Connecting to OneDrive...</h2>
                <p className="text-gray-500 mt-2">Please wait while we complete the authentication.</p>
                <p className="text-xs text-gray-400 mt-4">You can close this window if it doesn't close automatically.</p>
            </div>
        </div>
    );
};

export default OneDriveCallback;
