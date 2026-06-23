/**
 * Web Coupons Controller
 * Admin web console (djt-web) — discount offers and promo codes.
 */

const std = require(appRoot + '/utils/standardMessages');
const mdl = require('../models/couponsMdl');

exports.list = function(req, res) {
    mdl.listMdl()
        .then(rows => res.status(200).json({ status: 200, rows: rows || [] }))
        .catch(e => { console.error('[coupons] list', e); res.status(500).json({ status: 500, error: 'Failed to load coupons' }); });
};

exports.get = function(req, res) {
    mdl.getByIdMdl({ id: req.params.id })
        .then(rows => res.status(200).json({ status: 200, row: (rows && rows[0]) || null }))
        .catch(e => { console.error('[coupons] get', e); res.status(500).json({ status: 500, error: 'Failed to load coupons' }); });
};
