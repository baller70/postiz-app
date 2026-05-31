#!/bin/bash
# Refresh YouTube OAuth tokens every 45 minutes
# Prevents "Token expired" errors in Postiz

YT_ACCOUNTS=$(psql -U kevinhouston -h localhost -d postiz -t -A -c "SELECT id || '|' || \"refreshToken\" || '|' || name FROM \"Integration\" WHERE \"providerIdentifier\" = 'youtube' AND \"deletedAt\" IS NULL AND \"refreshNeeded\" = false;" 2>/dev/null)

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
    echo "$(date) Refreshed: $NAME (expires: $EXP_TS)"
  else
    echo "$(date) Failed: $NAME"
  fi
done
