// Basic wrapper to ensure clean context usage if needed
const Layout = ({ children }) => {
    return (
        <div className="h-full w-full">
            {children}
        </div>
    );
};

export default Layout;
