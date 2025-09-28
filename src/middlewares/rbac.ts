import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AppError } from '../utils/AppError';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';

enum Role {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

enum Permission {
  // User permissions
  READ_OWN_PROFILE = 'READ_OWN_PROFILE',
  UPDATE_OWN_PROFILE = 'UPDATE_OWN_PROFILE',
  DELETE_OWN_ACCOUNT = 'DELETE_OWN_ACCOUNT',
  
  // Chat permissions
  READ_OWN_MESSAGES = 'READ_OWN_MESSAGES',
  SEND_MESSAGES = 'SEND_MESSAGES',
  DELETE_OWN_MESSAGES = 'DELETE_OWN_MESSAGES',
  
  // Match permissions
  LIKE_PROFILES = 'LIKE_PROFILES',
  VIEW_MATCHES = 'VIEW_MATCHES',
  
  // Moderator permissions
  VIEW_REPORTS = 'VIEW_REPORTS',
  UPDATE_REPORTS = 'UPDATE_REPORTS',
  MODERATE_CONTENT = 'MODERATE_CONTENT',
  SUSPEND_USERS = 'SUSPEND_USERS',
  
  // Admin permissions
  VIEW_ALL_USERS = 'VIEW_ALL_USERS',
  UPDATE_USER_PROFILES = 'UPDATE_USER_PROFILES',
  DELETE_USERS = 'DELETE_USERS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  MANAGE_SUBSCRIPTIONS = 'MANAGE_SUBSCRIPTIONS',
  SEND_BROADCASTS = 'SEND_BROADCASTS',
  
  // Super Admin permissions
  MANAGE_ADMINS = 'MANAGE_ADMINS',
  VIEW_SYSTEM_LOGS = 'VIEW_SYSTEM_LOGS',
  MANAGE_SYSTEM_SETTINGS = 'MANAGE_SYSTEM_SETTINGS'
}

// Define base permissions first
const USER_PERMISSIONS = [
  Permission.READ_OWN_PROFILE,
  Permission.UPDATE_OWN_PROFILE,
  Permission.DELETE_OWN_ACCOUNT,
  Permission.READ_OWN_MESSAGES,
  Permission.SEND_MESSAGES,
  Permission.DELETE_OWN_MESSAGES,
  Permission.LIKE_PROFILES,
  Permission.VIEW_MATCHES
];

const MODERATOR_PERMISSIONS = [
  ...USER_PERMISSIONS,
  Permission.VIEW_REPORTS,
  Permission.UPDATE_REPORTS,
  Permission.MODERATE_CONTENT,
  Permission.SUSPEND_USERS
];

const ADMIN_PERMISSIONS = [
  ...MODERATOR_PERMISSIONS,
  Permission.VIEW_ALL_USERS,
  Permission.UPDATE_USER_PROFILES,
  Permission.DELETE_USERS,
  Permission.VIEW_ANALYTICS,
  Permission.MANAGE_SUBSCRIPTIONS,
  Permission.SEND_BROADCASTS
];

const SUPER_ADMIN_PERMISSIONS = [
  ...ADMIN_PERMISSIONS,
  Permission.MANAGE_ADMINS,
  Permission.VIEW_SYSTEM_LOGS,
  Permission.MANAGE_SYSTEM_SETTINGS
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: USER_PERMISSIONS,
  [Role.MODERATOR]: MODERATOR_PERMISSIONS,
  [Role.ADMIN]: ADMIN_PERMISSIONS,
  [Role.SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS
};


declare global {
  namespace Express {
    interface Request {
      userRole?: Role;
      userPermissions?: Permission[];
    }
  }
}

export const loadUserRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      return next();
    }

    // Check if user has admin role in database
    // This assumes you have a user_roles table or role field in users table
    const userRole = await prisma.$queryRaw<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${req.user.id} AND is_active = true
      ORDER BY 
        CASE 
          WHEN role = 'SUPER_ADMIN' THEN 1 
          WHEN role = 'ADMIN' THEN 2 
          WHEN role = 'MODERATOR' THEN 3 
          ELSE 4 
        END 
      LIMIT 1
    `;

    const role = userRole[0]?.role as Role || Role.USER;
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[Role.USER];

    req.userRole = role;
    req.userPermissions = permissions;

    // Log admin access
    if (role !== Role.USER) {
      logger.info(`Admin access detected`, {
        userId: req.user.id,
        role,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    next();
  } catch (error) {
    logger.error('Error loading user role:', error);
    // Continue as regular user if role check fails
    req.userRole = Role.USER;
    req.userPermissions = ROLE_PERMISSIONS[Role.USER];
    next();
  }
};

export const requireRole = (requiredRole: Role) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.userRole || Role.USER;
    
    const roleHierarchy = {
      [Role.USER]: 1,
      [Role.MODERATOR]: 2,
      [Role.ADMIN]: 3,
      [Role.SUPER_ADMIN]: 4
    };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      logger.warn(`Access denied - insufficient role`, {
        userId: req.user?.id,
        userRole,
        requiredRole,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  };
};

export const requirePermission = (requiredPermission: Permission) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userPermissions = req.userPermissions || ROLE_PERMISSIONS[Role.USER];

    if (!userPermissions.includes(requiredPermission)) {
      logger.warn(`Access denied - missing permission`, {
        userId: req.user?.id,
        userRole: req.userRole,
        requiredPermission,
        userPermissions: userPermissions.slice(0, 5), // Log first 5 permissions only
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  };
};

export const requireAdmin = requireRole(Role.ADMIN);
export const requireModerator = requireRole(Role.MODERATOR);
export const requireSuperAdmin = requireRole(Role.SUPER_ADMIN);

export { Role, Permission };