#!/bin/bash
# ============================================================
# Postiz Token Auto-Refresh — ALL Platforms
# Runs every 45 minutes via cron
# Guarantees all social media tokens stay alive
# ============================================================

LOG_PREFIX="[token-refresh $(date '+%Y-%m-%d %H:%M')]"
ALERT_FILE="/var/log/postiz-token-alerts.log"

# ---- YouTube (expires every 1 hour, has refresh tokens) ----
YT_ACCOUNTS=$(psql -U kevinhouston -h localhost -d postiz -t -A -c "SELECT id || '|' || \"refreshToken\" || '|' || name FROM \"Integration\" WHERE \"providerIdentifier\" = 'youtube' AND \"deletedAt\" IS NULL AND \"refreshNeeded\" = false AND \"refreshToken\" IS NOT NULL AND LENGTH(\"refreshToken\") > 10;" 2>/dev/null)

echo "$YT_ACCOUNTS" | while IFS= read -r line; do
  [ -z "$line" ] && continue
  ID=$(echo "$line" | cut -d'|' -f1)
  RT=$(echo "$line" | cut -d'|' -f2)
  NAME=$(echo "$line" | cut -d'|' -f3-)
  RESULT=$(docker exec postiz node -e "
    const { google } = require('googleapis');
    const c = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.FRONTEND_URL + '/integrations/social/youtube');
    c.setCredentials({ refresh_token: '$RT' });
    c.refreshAccessToken().then(({credentials}) => {
      console.log(credentials.access_token + '|' + credentials.expiry_date);
    }).catch(e => console.error('ERROR:' + e.message));
  " 2>/dev/null)
  TOKEN=$(echo "$RESULT" | head -1 | cut -d'|' -f1)
  EXP=$(echo "$RESULT" | head -1 | cut -d'|' -f2)
  if [ -n "$TOKEN" ] && [ ${#TOKEN} -gt 100 ]; then
    EXP_TS=$(python3 -c "from datetime import datetime; print(datetime.fromtimestamp($EXP/1000).strftime('%Y-%m-%d %H:%M:%S'))" 2>/dev/null)
    psql -U kevinhouston -h localhost -d postiz -c "UPDATE \"Integration\" SET token = '$TOKEN', \"tokenExpiration\" = '$EXP_TS', \"updatedAt\" = NOW() WHERE id = '$ID';" >/dev/null 2>&1
    echo "$LOG_PREFIX YouTube/$NAME: OK (expires $EXP_TS)"
  else
    echo "$LOG_PREFIX YouTube/$NAME: FAILED" 
    echo "$(date) ALERT: YouTube/$NAME refresh failed" >> "$ALERT_FILE"
  fi
done

# ---- GMB (expires every 1 hour, has refresh tokens) ----
GMB_ACCOUNTS=$(psql -U kevinhouston -h localhost -d postiz -t -A -c "SELECT id || '|' || \"refreshToken\" || '|' || name FROM \"Integration\" WHERE \"providerIdentifier\" = 'gmb' AND \"deletedAt\" IS NULL AND \"refreshNeeded\" = false AND \"refreshToken\" IS NOT NULL AND LENGTH(\"refreshToken\") > 10;" 2>/dev/null)

echo "$GMB_ACCOUNTS" | while IFS= read -r line; do
  [ -z "$line" ] && continue
  ID=$(echo "$line" | cut -d'|' -f1)
  RT=$(echo "$line" | cut -d'|' -f2)
  NAME=$(echo "$line" | cut -d'|' -f3-)
  RESULT=$(docker exec postiz node -e "
    const { google } = require('googleapis');
    const c = new google.auth.OAuth2(process.env.GOOGLE_GMB_CLIENT_ID, process.env.GOOGLE_GMB_CLIENT_SECRET, process.env.FRONTEND_URL + '/integrations/social/gmb');
    c.setCredentials({ refresh_token: '$RT' });
    c.refreshAccessToken().then(({credentials}) => {
      console.log(credentials.access_token + '|' + credentials.expiry_date);
    }).catch(e => console.error('ERROR:' + e.message));
  " 2>/dev/null)
  TOKEN=$(echo "$RESULT" | head -1 | cut -d'|' -f1)
  EXP=$(echo "$RESULT" | head -1 | cut -d'|' -f2)
  if [ -n "$TOKEN" ] && [ ${#TOKEN} -gt 100 ]; then
    EXP_TS=$(python3 -c "from datetime import datetime; print(datetime.fromtimestamp($EXP/1000).strftime('%Y-%m-%d %H:%M:%S'))" 2>/dev/null)
    psql -U kevinhouston -h localhost -d postiz -c "UPDATE \"Integration\" SET token = '$TOKEN', \"tokenExpiration\" = '$EXP_TS', \"updatedAt\" = NOW() WHERE id = '$ID';" >/dev/null 2>&1
    echo "$LOG_PREFIX GMB/$NAME: OK (expires $EXP_TS)"
  else
    echo "$LOG_PREFIX GMB/$NAME: FAILED"
  fi
done

# ---- Meta (Facebook/Instagram/Threads) — 60 day tokens ----
# Refresh any expiring within 7 days
META_ACCOUNTS=$(psql -U kevinhouston -h localhost -d postiz -t -A -c "SELECT id || '|' || token || '|' || name || '|' || \"providerIdentifier\" FROM \"Integration\" WHERE \"providerIdentifier\" IN ('facebook', 'instagram', 'threads') AND \"deletedAt\" IS NULL AND \"refreshNeeded\" = false AND LENGTH(token) > 10 AND LENGTH(\"refreshToken\") > 10 AND \"tokenExpiration\" < NOW() + interval '7 days';" 2>/dev/null)

if [ -n "$META_ACCOUNTS" ]; then
  echo "$META_ACCOUNTS" | while IFS= read -r line; do
    [ -z "$line" ] && continue
    ID=$(echo "$line" | cut -d'|' -f1)
    CURRENT_TOKEN=$(echo "$line" | cut -d'|' -f2)
    NAME=$(echo "$line" | cut -d'|' -f3)
    PLATFORM=$(echo "$line" | cut -d'|' -f4)
    RESULT=$(curl -s "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=2746552709013302&client_secret=24d52e6dcf1078b5d9c2e816d8ee7957&fb_exchange_token=$CURRENT_TOKEN" 2>/dev/null)
    NEW_TOKEN=$(echo "$RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('access_token',''))" 2>/dev/null)
    EXPIRES_IN=$(echo "$RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('expires_in','0'))" 2>/dev/null)
    if [ -n "$NEW_TOKEN" ] && [ ${#NEW_TOKEN} -gt 50 ]; then
      EXP_TS=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(seconds=int('${EXPIRES_IN:-0}'))).strftime('%Y-%m-%d %H:%M:%S'))" 2>/dev/null)
      psql -U kevinhouston -h localhost -d postiz -c "UPDATE \"Integration\" SET token = '$NEW_TOKEN', \"refreshToken\" = '$NEW_TOKEN', \"tokenExpiration\" = '$EXP_TS', \"updatedAt\" = NOW() WHERE id = '$ID';" >/dev/null 2>&1
      echo "$LOG_PREFIX Meta/$PLATFORM/$NAME: REFRESHED (new expiry $EXP_TS)"
    else
      echo "$LOG_PREFIX Meta/$PLATFORM/$NAME: REFRESH FAILED"
      echo "$(date) ALERT: Meta/$PLATFORM/$NAME refresh failed - may need manual reconnect" >> "$ALERT_FILE"
    fi
  done
else
  echo "$LOG_PREFIX Meta: all tokens healthy"
fi

# ---- LinkedIn — 60 day tokens ----
# Refresh if expiring within 7 days
LI_ACCOUNTS=$(psql -U kevinhouston -h localhost -d postiz -t -A -c "SELECT id || '|' || \"refreshToken\" || '|' || name FROM \"Integration\" WHERE \"providerIdentifier\" = 'linkedin' AND \"deletedAt\" IS NULL AND \"refreshNeeded\" = false AND LENGTH(\"refreshToken\") > 10 AND \"tokenExpiration\" < NOW() + interval '7 days';" 2>/dev/null)

if [ -n "$LI_ACCOUNTS" ]; then
  echo "$LI_ACCOUNTS" | while IFS= read -r line; do
    [ -z "$line" ] && continue
    ID=$(echo "$line" | cut -d'|' -f1)
    RT=$(echo "$line" | cut -d'|' -f2)
    NAME=$(echo "$line" | cut -d'|' -f3-)
    RESULT=$(docker exec postiz node -e "
      fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({grant_type:'refresh_token', refresh_token:'$RT', client_id:process.env.LINKEDIN_CLIENT_ID, client_secret:process.env.LINKEDIN_CLIENT_SECRET})
      }).then(r=>r.json()).then(d=>{
        if(d.access_token) console.log(d.access_token+'|'+(d.refresh_token||'')+'|'+d.expires_in);
        else console.log('ERROR:'+JSON.stringify(d));
      }).catch(e=>console.log('ERROR:'+e.message));
    " 2>/dev/null)
    TOKEN=$(echo "$RESULT" | head -1 | cut -d'|' -f1)
    NEW_RT=$(echo "$RESULT" | head -1 | cut -d'|' -f2)
    EXP_SECS=$(echo "$RESULT" | head -1 | cut -d'|' -f3)
    if [ -n "$TOKEN" ] && [ ${#TOKEN} -gt 50 ] && [ "$TOKEN" != "ERROR"* ]; then
      EXP_TS=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(seconds=int('${EXP_SECS:-0}'))).strftime('%Y-%m-%d %H:%M:%S'))" 2>/dev/null)
      RT_UPDATE=""
      if [ -n "$NEW_RT" ] && [ ${#NEW_RT} -gt 10 ]; then
        RT_UPDATE=", \"refreshToken\" = '$NEW_RT'"
      fi
      psql -U kevinhouston -h localhost -d postiz -c "UPDATE \"Integration\" SET token = '$TOKEN' $RT_UPDATE, \"tokenExpiration\" = '$EXP_TS', \"updatedAt\" = NOW() WHERE id = '$ID';" >/dev/null 2>&1
      echo "$LOG_PREFIX LinkedIn/$NAME: REFRESHED (expires $EXP_TS)"
    else
      echo "$LOG_PREFIX LinkedIn/$NAME: NO REFRESH TOKEN - needs manual reconnect"
      echo "$(date) ALERT: LinkedIn/$NAME has no refresh token - reconnect at https://postiz.89-167-33-236.sslip.io/third-party" >> "$ALERT_FILE"
    fi
  done
else
  echo "$LOG_PREFIX LinkedIn: healthy"
fi

# ---- TikTok — refresh if expiring within 1 day ----
TT_ACCOUNTS=$(psql -U kevinhouston -h localhost -d postiz -t -A -c "SELECT id || '|' || \"refreshToken\" || '|' || name FROM \"Integration\" WHERE \"providerIdentifier\" = 'tiktok' AND \"deletedAt\" IS NULL AND \"refreshNeeded\" = false AND LENGTH(\"refreshToken\") > 10 AND \"tokenExpiration\" < NOW() + interval '1 day';" 2>/dev/null)

if [ -n "$TT_ACCOUNTS" ]; then
  echo "$TT_ACCOUNTS" | while IFS= read -r line; do
    [ -z "$line" ] && continue
    ID=$(echo "$line" | cut -d'|' -f1)
    RT=$(echo "$line" | cut -d'|' -f2)
    NAME=$(echo "$line" | cut -d'|' -f3-)
    RESULT=$(docker exec postiz node -e "
      fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({grant_type:'refresh_token', refresh_token:'$RT', client_key:process.env.TIKTOK_CLIENT_ID, client_secret:process.env.TIKTOK_CLIENT_SECRET})
      }).then(r=>r.json()).then(d=>{
        if(d.access_token) console.log(d.access_token+'|'+(d.refresh_token||'')+'|'+d.expires_in);
        else console.log('ERROR:'+JSON.stringify(d));
      }).catch(e=>console.log('ERROR:'+e.message));
    " 2>/dev/null)
    TOKEN=$(echo "$RESULT" | head -1 | cut -d'|' -f1)
    NEW_RT=$(echo "$RESULT" | head -1 | cut -d'|' -f2)
    EXP_SECS=$(echo "$RESULT" | head -1 | cut -d'|' -f3)
    if [ -n "$TOKEN" ] && [ ${#TOKEN} -gt 50 ] && [[ "$TOKEN" != ERROR* ]]; then
      EXP_TS=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(seconds=int('${EXP_SECS:-86400}'))).strftime('%Y-%m-%d %H:%M:%S'))" 2>/dev/null)
      RT_UPDATE=""
      if [ -n "$NEW_RT" ] && [ ${#NEW_RT} -gt 10 ]; then
        RT_UPDATE=", \"refreshToken\" = '$NEW_RT'"
      fi
      psql -U kevinhouston -h localhost -d postiz -c "UPDATE \"Integration\" SET token = '$TOKEN' $RT_UPDATE, \"tokenExpiration\" = '$EXP_TS', \"updatedAt\" = NOW() WHERE id = '$ID';" >/dev/null 2>&1
      echo "$LOG_PREFIX TikTok/$NAME: REFRESHED (expires $EXP_TS)"
    else
      echo "$LOG_PREFIX TikTok/$NAME: refresh failed"
    fi
  done
else
  echo "$LOG_PREFIX TikTok: healthy or no refresh needed"
fi

# ---- FINAL HEALTH REPORT ----
echo ""
echo "$LOG_PREFIX === HEALTH REPORT ==="
PROBLEMS=$(psql -U kevinhouston -h localhost -d postiz -t -A -c "
SELECT \"providerIdentifier\" || '/' || name || ' — expires ' || to_char(\"tokenExpiration\", 'YYYY-MM-DD') || 
  CASE WHEN LENGTH(\"refreshToken\") < 10 OR \"refreshToken\" IS NULL THEN ' [NO AUTO-REFRESH - MANUAL RECONNECT NEEDED]' ELSE ' [auto-refresh active]' END
FROM \"Integration\" 
WHERE \"deletedAt\" IS NULL AND \"refreshNeeded\" = false 
AND \"tokenExpiration\" IS NOT NULL 
AND \"tokenExpiration\" < NOW() + interval '14 days'
AND \"tokenExpiration\" > '2026-01-01'
ORDER BY \"tokenExpiration\";" 2>/dev/null)

if [ -n "$PROBLEMS" ]; then
  echo "$LOG_PREFIX Tokens expiring within 14 days:"
  echo "$PROBLEMS" | while read -r line; do echo "  $line"; done
else
  echo "$LOG_PREFIX ALL TOKENS HEALTHY - no action needed"
fi
