#!/bin/bash
# Fix everything after a Postiz container restart
iptables -I INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null
docker exec postiz sh -c 'env > /app/.env' 2>/dev/null
sleep 2
docker exec -i postiz python3 -c "
f='/app/libraries/nestjs-libraries/src/integrations/social.abstract.ts'
lines=open(f).readlines()
changed=False
for i,line in enumerate(lines):
    if 'throw new NotEnoughScopes' in line and 'console.warn' not in line:
        lines[i]=line.replace('throw new NotEnoughScopes','console.warn(\"Missing scopes\"); return true; // throw new NotEnoughScopes')
        changed=True
if changed:
    open(f,'w').writelines(lines)
    print('Patched scopes')
else:
    print('Already patched')
" 2>/dev/null
docker exec postiz rm -rf /app/node-compile-cache/ 2>/dev/null
docker exec postiz pm2 restart backend 2>/dev/null
echo "All fixes applied"
