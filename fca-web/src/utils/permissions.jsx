import { useAuth } from '@/auth/AuthProvider'

/**
 * Permission definitions for each role
 * 
 * Resources: clients, users, programs, cm_companies, marketers, settings, messages
 * Actions: create, read, update, delete
 */
const PERMISSIONS = {
  admin: {
    clients: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete'],
    programs: ['create', 'read', 'update', 'delete'],
    cm_companies: ['create', 'read', 'update', 'delete'],
    marketers: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    messages: ['create', 'read', 'update', 'delete'],
    invites: ['create', 'read', 'delete'],
  },
  marketer: {
    clients: ['create', 'read', 'update'],
    users: ['read'], // Can view team members
    programs: ['read'],
    cm_companies: ['create', 'read', 'update'],
    marketers: ['read'],
    settings: ['read'],
    messages: ['create', 'read', 'update'],
    invites: [],
  },
  viewer: {
    clients: ['read'],
    users: ['read'],
    programs: ['read'],
    cm_companies: ['read'],
    marketers: ['read'],
    settings: ['read'],
    messages: ['read'],
    invites: [],
  },
}

/**
 * Check if user has permission to perform an action on a resource
 * @param {Object} user - User object with role property
 * @param {string} action - Action to perform (create, read, update, delete)
 * @param {string} resource - Resource name (clients, users, etc.)
 * @returns {boolean} Whether user has permission
 */
export function can(user, action, resource) {
  if (!user || !user.role) return false

  const rolePermissions = PERMISSIONS[user.role]
  if (!rolePermissions) return false

  const resourcePermissions = rolePermissions[resource]
  if (!resourcePermissions) return false

  return resourcePermissions.includes(action)
}

/**
 * React hook for permission checking
 * @returns {Object} Permission checking functions
 */
export function usePermissions() {
  const { user } = useAuth()

  return {
    /**
     * Check if user can perform action on resource
     */
    can: (action, resource) => can(user, action, resource),

    /**
     * Shorthand for common permissions
     */
    canCreate: (resource) => can(user, 'create', resource),
    canRead: (resource) => can(user, 'read', resource),
    canUpdate: (resource) => can(user, 'update', resource),
    canDelete: (resource) => can(user, 'delete', resource),

    /**
     * Role checks
     */
    isAdmin: user?.role === 'admin',
    isMarketer: user?.role === 'marketer',
    isViewer: user?.role === 'viewer',

    /**
     * Get current user
     */
    user,

    /**
     * Check if user has any of multiple permissions
     */
    canAny: (actions, resource) => {
      return actions.some(action => can(user, action, resource))
    },

    /**
     * Check if user has all of multiple permissions
     */
    canAll: (actions, resource) => {
      return actions.every(action => can(user, action, resource))
    },
  }
}

/**
 * Higher-order component to protect components based on permissions
 * @param {React.Component} Component - Component to wrap
 * @param {string} action - Required action
 * @param {string} resource - Required resource
 * @returns {React.Component} Wrapped component
 */
export function withPermission(Component, action, resource) {
  return function PermissionGuard(props) {
    const { can: checkPermission } = usePermissions()

    if (!checkPermission(action, resource)) {
      return (
        <div className="p-4 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access this feature.
          </p>
        </div>
      )
    }

    return <Component {...props} />
  }
}

/**
 * Component to conditionally render based on permissions
 */
export function Can({ action, resource, fallback = null, children }) {
  const { can: checkPermission } = usePermissions()

  if (!checkPermission(action, resource)) {
    return fallback
  }

  return children
}

/**
 * Component to conditionally render based on role
 */
export function HasRole({ roles, fallback = null, children }) {
  const { user } = useAuth()

  const roleArray = Array.isArray(roles) ? roles : [roles]

  if (!user || !roleArray.includes(user.role)) {
    return fallback
  }

  return children
}

export default {
  can,
  usePermissions,
  withPermission,
  Can,
  HasRole,
}

