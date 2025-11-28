# When Session Status Changes to 'completed'

## Session Completion Flow

### Step-by-Step Process:

```
1. USER ACTION: User clicks "Stop Charging" button
   ↓
2. FRONTEND: handleStopCharging() function called
   ↓
3. API CALL: sessionService.stopSession({ session_id: currentSessionId })
   ↓
4. BACKEND: exports.stopSession() controller function
   ↓
5. DATABASE UPDATE: sessionMdl.stopSessionMdl() executes SQL:
   UPDATE charging_sessions_t 
   SET sttus_cd = 'completed',  ← STATUS CHANGES HERE
       end_ts = NOW(),
       durn_mnts_nbr = TIMESTAMPDIFF(MINUTE, strt_ts, NOW()),
       enrgy_cnsmd_kwh = ${energyConsumed},
       ttl_cst_amt = ${totalCost},
       prgrss_pct = 100
   WHERE sssn_id = ${sessionId}
   ↓
6. STATUS: Session is now 'completed' ✅
```

## Exact Moment Status Changes:

**Status changes to 'completed' when:**
- ✅ User clicks "Stop Charging" button
- ✅ `stopSession` API is called successfully
- ✅ `stopSessionMdl` SQL query executes successfully
- ✅ Database UPDATE statement completes

## Code Locations:

### 1. Frontend Trigger (mobile_app/src/pages/charging/page.tsx:336)
```typescript
const handleStopCharging = async () => {
  // Calls stopSession API
  const stoppedSession = await sessionService.stopSession({
    session_id: currentSessionId
  });
}
```

### 2. Backend Controller (api/modules/sessions/controllers/sessionCtrl.js:278)
```javascript
// Stop session with actual cost
return sessionMdl.stopSessionMdl({ 
    sessionId: session_id, 
    energyConsumed: energyConsumed, 
    totalCost: actualTotalCost 
})
```

### 3. Database Model (api/modules/sessions/models/sessionMdl.js:47-55)
```javascript
exports.stopSessionMdl = function(data) {
    const QRY_TO_EXEC = `UPDATE charging_sessions_t 
        SET sttus_cd = 'completed',  ← THIS IS WHERE STATUS CHANGES
            end_ts = NOW(), 
            durn_mnts_nbr = TIMESTAMPDIFF(MINUTE, strt_ts, NOW()), 
            enrgy_cnsmd_kwh = ${data.energyConsumed}, 
            ttl_cst_amt = ${data.totalCost}, 
            prgrss_pct = 100 
        WHERE sssn_id = ${data.sessionId}`;
    
    return dbutil.execQuery(sqldb.MySQLConPool, QRY_TO_EXEC, cntxtDtls);
};
```

## Important Notes:

1. **Status changes IMMEDIATELY** when `stopSessionMdl` query executes
2. **No delay** - it's a direct database UPDATE
3. **Status is 'completed'** regardless of:
   - Whether charging was stopped early
   - Whether charging completed fully
   - Whether payment was successful or pending

## If Status is NOT 'completed' After Stopping:

**Possible Issues:**
1. ❌ `stopSession` API was not called from frontend
2. ❌ API call failed (network error, authentication error)
3. ❌ Database UPDATE query failed
4. ❌ Error occurred before status update

**To Verify:**
1. Check browser console for API errors
2. Check backend logs for `[stopSessionMdl] Query:` log
3. Check database directly:
   ```sql
   SELECT sssn_id, sttus_cd, strt_ts, end_ts 
   FROM charging_sessions_t 
   WHERE sssn_id = YOUR_SESSION_ID;
   ```

## Summary:

**Session is marked 'completed' the moment:**
- User clicks "Stop Charging" button
- AND the `stopSessionMdl` database UPDATE query executes successfully

**This happens in:**
- File: `api/modules/sessions/models/sessionMdl.js`
- Function: `stopSessionMdl`
- Line: 49 (SQL SET clause)

