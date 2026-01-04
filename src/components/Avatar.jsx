const Avatar = ({ name, size = 'md' }) => {
    const getInitials = (fullName) => {
        if (!fullName) return '?';
        const names = fullName.trim().split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return fullName.substring(0, 2).toUpperCase();
    };

    const getColorFromName = (name) => {
        const colors = [
            'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
            'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500'
        ];
        const index = (name || '').charCodeAt(0) % colors.length;
        return colors[index];
    };

    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base'
    };

    return (
        <div
            className={`${sizeClasses[size]} ${getColorFromName(name)} rounded-full flex items-center justify-center text-white font-bold`}
        >
            {getInitials(name)}
        </div>
    );
};

export default Avatar;
