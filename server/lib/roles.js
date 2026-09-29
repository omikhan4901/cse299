/**
 * Who is an admin. Super admins are set by email in SUPERADMIN_EMAILS (comma-separated);
 * they can do everything, including making other people admins. Other admins have
 * role "admin" on their account.
 */
const superadminEmails = () => (process.env.SUPERADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isSuperadmin = (user) => !!user?.email && superadminEmails().includes(String(user.email).toLowerCase());
const roleOf = (user) => (isSuperadmin(user) ? 'superadmin' : user?.role || 'user');
const isAdmin = (user) => ['admin', 'superadmin'].includes(roleOf(user));

module.exports = { superadminEmails, isSuperadmin, roleOf, isAdmin };
