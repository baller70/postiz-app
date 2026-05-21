#!/bin/bash
# Patch Postiz container with auto-login on every restart
CONTAINER="postiz"

echo "Waiting for Postiz container files..."
for i in $(seq 1 60); do
  if docker exec $CONTAINER test -f /app/apps/backend/dist/apps/backend/src/main.js 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "Patching backend auto-login endpoint..."
docker exec $CONTAINER python3 << 'PYEOF'
fp = '/app/apps/backend/dist/apps/backend/src/main.js'
with open(fp) as f:
    content = f.read()
if 'auto-login-token' in content:
    print('Backend already patched')
else:
    old = '    app.use((0, compression_1.default)());'
    new = """    app.use((0, compression_1.default)());
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get("/auto-login-token", async (_req, res) => {
        try {
            const { PrismaClient } = require("@prisma/client");
            const { AuthService: AuthHelper } = require("/app/apps/backend/dist/libraries/helpers/src/auth/auth.service.js");
            const prisma = new PrismaClient();
            const user = await prisma.user.findFirst();
            await prisma.$disconnect();
            if (user) {
                const token = AuthHelper.signJWT({ id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin, activated: true });
                return res.json({ token });
            }
            return res.status(404).json({ error: "No users found" });
        } catch (e) {
            return res.status(500).json({ error: "Auto-login failed: " + e.message });
        }
    });"""
    if old in content:
        content = content.replace(old, new, 1)
        with open(fp, 'w') as f:
            f.write(content)
        print('Backend PATCHED')
    else:
        print('Backend patch target not found')
PYEOF

echo "Patching frontend middleware auto-login..."
docker exec $CONTAINER python3 << 'PYEOF'
fp = '/app/apps/frontend/.next/server/src/middleware.js'
with open(fp) as f:
    content = f.read()
if 'auto-login-token' in content:
    print('Middleware already patched')
else:
    old = 'if(!a.pathname.startsWith("/auth")&&!t){let e=["google","settings"].find(e=>a.href.indexOf(e)>-1),t=e?(i.indexOf("?")>-1?"&":"?")+`provider=${("settings"===e?process.env.POSTIZ_GENERIC_OAUTH?"generic":"github":e).toUpperCase()}`:"";return ea.redirect(new URL(`/auth${i}${t}`,a.href))}'
    new = 'if(!a.pathname.startsWith("/auth")&&!t){try{let _r=await fetch((process.env.BACKEND_INTERNAL_URL||"http://localhost:3000")+"/auto-login-token");if(_r.ok){let _d=await _r.json();if(_d.token){let _resp=ea.redirect(new URL(a.pathname+a.search,a.href));_resp.cookies.set("auth",_d.token,{path:"/",maxAge:365*24*60*60});_resp.cookies.set("showorg","419641c3-f6ed-4ad1-93e6-d560e769f8ad",{path:"/",maxAge:365*24*60*60});return _resp}}}catch(_e){}let e=["google","settings"].find(e=>a.href.indexOf(e)>-1),t=e?(i.indexOf("?")>-1?"&":"?")+`provider=${("settings"===e?process.env.POSTIZ_GENERIC_OAUTH?"generic":"github":e).toUpperCase()}`:"";return ea.redirect(new URL(`/auth${i}${t}`,a.href))}'
    if old in content:
        content = content.replace(old, new, 1)
        with open(fp, 'w') as f:
            f.write(content)
        print('Middleware PATCHED')
    else:
        print('Middleware patch target not found - image may have changed')
PYEOF

echo "Auto-login patch complete."
