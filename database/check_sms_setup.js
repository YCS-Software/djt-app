/**
 * Check the SMS template / variable rows for mistakes, and optionally preview a
 * message with real values. Nothing is sent and nothing is changed.
 *
 *   node database/check_sms_setup.js
 *       -> lists every problem found in the rows
 *
 *   node database/check_sms_setup.js DJT_OTP 9876543210 "{\"otp\":\"4821\"}"
 *       -> also shows the final SMS text for that template code, exactly as
 *          messages.send('DJT_OTP', '9876543210', { otp: '4821' }) would send it
 *
 * Run it every time you insert or change rows.
 */

const path = require('path');
global.appRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(global.appRoot, '.env') });
const { pool } = require(path.join(global.appRoot, 'config/db.config'));

// Keep this tool's output readable: the DB helpers log every query.
const realLog = console.log;
console.log = () => {};
const say = (...a) => realLog(...a);

const messages = require(path.join(global.appRoot, 'utils/messageService'));

(async () => {
    let exitCode = 0;
    try {
        const result = await messages.checkSetup();
        say('\n=== SMS setup check ===');
        say(`Active: ${result.summary.templates} template(s), ${result.summary.variables} variable(s)\n`);
        if (result.errors.length) {
            say(`ERRORS (${result.errors.length}) — these messages will fail:`);
            result.errors.forEach((e) => say('  ✗ ' + e));
            exitCode = 1;
        } else {
            say('No errors.');
        }
        if (result.warnings.length) {
            say(`\nWarnings (${result.warnings.length}):`);
            result.warnings.forEach((w) => say('  ! ' + w));
        }

        say('\nTemplate codes the application already sends, and the values it passes:');
        Object.keys(messages.TEMPLATES).forEach((code) => {
            say(`  ${code.padEnd(22)} ${messages.TEMPLATES[code].keys.join(', ')}`);
        });
        say(`  (every template can also use: ${messages.COMMON_KEYS.join(', ')})`);

        const code = process.argv[2];
        if (code) {
            const mobile = process.argv[3];
            let data = {};
            if (process.argv[4]) {
                try { data = JSON.parse(process.argv[4]); }
                catch (e) { say('\n✗ The data argument is not valid JSON: ' + e.message); exitCode = 1; }
            }
            const m = await messages.preview(code, mobile, data);
            say(`\n=== Preview: ${code} — nothing is sent ===`);
            if (m.error) {
                say('  ✗ ' + m.error);
                exitCode = 1;
            } else {
                say(`  Template : ${m.template}  (MSG91 id ${m.provider_template_id}, sender ${m.sender || 'none'})`);
                say(`  To       : ${m.mobile || '(none)'}`);
                say(`  Variables: ${JSON.stringify(m.variables)}`);
                say(`  Text (${m.length} chars):`);
                m.text.split('\n').forEach((line) => say('      ' + line));
                m.problems.forEach((x) => say('  ✗ ' + x));
                say(`  Would send: ${m.would_send ? 'YES' : 'NO'}`);
            }
        }
        say('');
    } catch (e) {
        say('\n✗ Check failed: ' + ((e && (e.err_message || e.message)) || e));
        exitCode = 1;
    } finally {
        await pool.end().catch(() => {});
        process.exit(exitCode);
    }
})();
