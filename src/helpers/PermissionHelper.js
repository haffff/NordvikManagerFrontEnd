
export const PermissionsHelper = {
    CanRead: (permission) => {
        return permission & 1;
    },
    CanExecute: (permission) => {
        return permission & 2;
    },
    CanControl: (permission) => {
        return permission & 4;
    },
    CanEdit: (permission) => {
        return permission & 8;
    },
    CanDelete: (permission) => {
        return permission & 16;
    },
}

export default PermissionsHelper;