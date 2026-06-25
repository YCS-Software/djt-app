/**
 * Settings Controller
 * Admin web console (djt-web) — scope-keyed settings.
 *   GET  /web/settings/:scope  -> { status:200, settings:{...} }
 *   PUT  /web/settings/:scope  -> { status:200, message:'Settings saved' }
 * Backed by sttng_lst_t (keys stored as '<scope>.<key>').
 */

const mdl = require('../models/settingsMdl');

exports.getByScope = function(req, res) {
    const scope = req.params.scope || '';
    mdl.getByScopeMdl({ scope })
        .then(rows => {
            const settings = {};
            (rows || []).forEach(r => {
                const key = String(r.k || '').slice(scope.length + 1); // strip '<scope>.'
                if (key) settings[key] = r.v;
            });
            res.status(200).json({ status: 200, settings });
        })
        .catch(e => {
            // Never break the settings form — fall back to an empty blob.
            console.error('[settings] getByScope', e);
            res.status(200).json({ status: 200, settings: {} });
        });
};

exports.saveByScope = function(req, res) {
    const scope = req.params.scope || '';
    const body = req.body || {};
    const entries = Object.keys(body).map(k => ({ scope, key: k, value: body[k] }));
    Promise.all(entries.map(e => mdl.saveByScopeMdl(e)))
        .then(() => res.status(200).json({ status: 200, message: 'Settings saved' }))
        .catch(e => {
            console.error('[settings] saveByScope', e);
            res.status(500).json({ status: 500, error: 'Failed to save settings' });
        });
};
