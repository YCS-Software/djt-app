/**
 * Web Menu Controller (admin web console — djt-web).
 * Returns the navigation menu for the logged-in user's role. The menu is
 * resolved from the user's role (usr_typ_cd) read from the DB, falling back to
 * the role embedded in the JWT. The frontend maps each item path to an icon.
 */
const mdl = require('../models/menuMdl');

// Curated admin sidebar (path-driven; the frontend supplies icons per path).
const ADMIN_MENU = [
    { heading: '', items: [
        { title: 'Dashboard', path: '/dashboard' },
    ] },
    { heading: 'MANAGE', items: [
        { title: 'Partners', path: '/partners' },
        { title: 'Locations', path: '/locations' },
        { title: 'Users', path: '/users' },
    ] },
    { heading: 'NETWORK', items: [
        { title: 'EV Drivers', path: '/drivers' },
        { title: 'Transactions', path: '/transactions' },
        { title: 'Schedules', path: '/schedules' },
        { title: 'Reservations', path: '/reservations' },
        { title: 'Charge Cards', path: '/cards' },
        { title: 'Reviews', path: '/reviews' },
        { title: 'Coupons', path: '/coupons' },
        { title: 'Reports', path: '/reports' },
        { title: 'Disputes', path: '/disputes' },
    ] },
    { heading: 'CHARGE', items: [
        { title: 'Charging Stations', path: '/stations' },
        { title: 'Sessions', path: '/sessions' },
        { title: 'Tariffs', path: '/tariffs' },
    ] },
    { heading: 'TOOLS & UTILITIES', items: [
        { title: 'Server Logs', path: '/server-logs' },
        { title: 'QR Generator', path: '/qr-generator' },
    ] },
];

// Owner/operator get a reduced view (extend as needed).
const OWNER_MENU = [
    { heading: '', items: [{ title: 'Dashboard', path: '/dashboard' }] },
    { heading: 'NETWORK', items: [
        { title: 'EV Drivers', path: '/drivers' },
        { title: 'Transactions', path: '/transactions' },
        { title: 'Reports', path: '/reports' },
    ] },
    { heading: 'CHARGE', items: [
        { title: 'Charging Stations', path: '/stations' },
        { title: 'Sessions', path: '/sessions' },
    ] },
];

const MENUS = { admin: ADMIN_MENU, owner: OWNER_MENU, operator: OWNER_MENU };

exports.getMenu = function (req, res) {
    const tokenRole = (req.user && req.user.userType) || 'admin';
    const userId = req.user && req.user.userId;
    mdl.getRoleMdl({ userId })
        .then(rows => {
            const role = (rows && rows[0] && rows[0].role) || tokenRole;
            const menu = MENUS[role] || ADMIN_MENU;
            res.status(200).json({ status: 200, role, menu });
        })
        .catch(() => res.status(200).json({ status: 200, role: tokenRole, menu: MENUS[tokenRole] || ADMIN_MENU }));
};
