/**
 * Bulk Remote Router (admin web console — djt-web)
 *
 * WIRING NOTE: this router must be reachable at POST /api/web/stations/bulk-remote
 * (the path the frontend bulkRemoteApi.execute calls). The wiring agent should
 * mount it so that resolves, e.g. one of:
 *   router.use('/stations', require('./bulkRemoteRtr'));   // -> /stations/bulk-remote
 * The router registers POST '/bulk-remote' (for mount at '/stations') and also
 * POST '/' (for mount directly at '/stations/bulk-remote') to be mount-agnostic.
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/web/bulkRemote/controllers/bulkRemoteCtrl');

router.post('/bulk-remote', ctrl.execute);
router.post('/', ctrl.execute);

module.exports = router;
