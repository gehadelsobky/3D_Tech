# دليل نشر 3D Tech على Hostinger VPS (AlmaLinux 9)

> الدومين: `3dtecheg.com`
> السيرفر: Hostinger VPS - AlmaLinux 9

---

## الخطوة 1: الاتصال بالسيرفر

افتح Terminal على جهازك واكتب:

```bash
ssh root@3dtecheg.com
```

أو لو عندك IP السيرفر:

```bash
ssh root@YOUR_SERVER_IP
```

هيسألك على الباسورد — ادخل باسورد الـ VPS اللي من Hostinger.

---

## الخطوة 2: تثبيت البرامج المطلوبة على السيرفر

انسخ الأوامر دي واحدة واحدة:

```bash
# تحديث النظام
dnf update -y

# تثبيت Node.js 20
dnf module enable nodejs:20 -y
dnf install nodejs -y

# التأكد من التثبيت
node -v
npm -v

# تثبيت PM2 (مدير التطبيقات)
npm install -g pm2

# تثبيت Nginx (السيرفر الأمامي)
dnf install nginx -y
systemctl enable nginx
systemctl start nginx

# تثبيت Git
dnf install git -y

# تثبيت Certbot (لشهادة SSL)
dnf install epel-release -y
dnf install certbot python3-certbot-nginx -y

# إنشاء مجلد للموقع
mkdir -p /var/www/3dtech
```

---

## الخطوة 3: رفع الكود على السيرفر

```bash
# ادخل مجلد الموقع
cd /var/www/3dtech

# حمّل الكود من GitHub
git clone https://github.com/gehadelsobky/3D_Tech.git .
```

هيسألك على اسم المستخدم والباسورد:
- **Username:** `gehadelsobky`
- **Password:** محتاج تعمل Personal Access Token من GitHub:
  1. روح https://github.com/settings/tokens
  2. اضغط **"Generate new token (classic)"**
  3. اختار صلاحية **repo** بس
  4. انسخ التوكن واستخدمه بدل الباسورد

---

## الخطوة 4: إعداد ملف البيئة (.env)

```bash
# انسخ ملف المثال
cp .env.example .env

# اعمل JWT Secret آمن
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

انسخ الناتج، وبعدين افتح ملف .env:

```bash
nano .env
```

عدّل القيم كالتالي:

```
PORT=3001
NODE_ENV=production
JWT_SECRET=الناتج_اللي_نسخته_فوق
CORS_ORIGINS=https://3dtecheg.com,https://www.3dtecheg.com
```

اضغط `Ctrl+O` للحفظ، ثم `Ctrl+X` للخروج.

---

## الخطوة 5: تثبيت الحزم وبناء الموقع

```bash
# تثبيت الحزم
npm install

# بناء الـ frontend
npm run build

# إنشاء مجلد اللوجات
mkdir -p logs

# إنشاء مجلد الأبلودات
mkdir -p server/uploads
```

---

## الخطوة 6: تشغيل التطبيق بـ PM2

```bash
# تشغيل التطبيق
pm2 start ecosystem.config.cjs

# التأكد إنه شغال
pm2 status

# حفظ الإعدادات (يشتغل تلقائي بعد إعادة تشغيل السيرفر)
pm2 save
pm2 startup
```

الأمر الأخير `pm2 startup` هيطبعلك أمر — انسخه والصقه واضغط Enter.

---

## الخطوة 7: إعداد Nginx

```bash
nano /etc/nginx/conf.d/3dtech.conf
```

الصق المحتوى ده:

```nginx
server {
    listen 80;
    server_name 3dtecheg.com www.3dtecheg.com;

    # حجم الرفع الأقصى
    client_max_body_size 10M;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

احفظ واخرج (`Ctrl+O` ثم `Ctrl+X`)، وبعدين:

```bash
# اختبار إعدادات Nginx
nginx -t

# إعادة تشغيل Nginx
systemctl restart nginx
```

---

## الخطوة 8: تثبيت شهادة SSL (مجانية)

```bash
certbot --nginx -d 3dtecheg.com -d www.3dtecheg.com
```

هيسألك على:
1. **الإيميل بتاعك** — ادخله
2. **الموافقة على الشروط** — اكتب `Y`
3. **مشاركة الإيميل** — اكتب `N`

Certbot هيعدل ملف Nginx تلقائيًا ويضيف SSL.

**التجديد التلقائي:**

```bash
# اختبار التجديد
certbot renew --dry-run

# التجديد بيحصل تلقائي عن طريق systemd timer
systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer
```

---

## الخطوة 9: إعداد Firewall

```bash
# تفعيل الفايروول
systemctl enable firewalld
systemctl start firewalld

# السماح بالمنافذ المطلوبة بس
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload

# التأكد
firewall-cmd --list-all
```

---

## الخطوة 10: تسجيل الدخول لأول مرة

1. افتح `https://3dtecheg.com/admin` في المتصفح
2. لقراءة كلمة المرور الأولية:

```bash
pm2 logs 3dtech --lines 50
```

ابحث عن سطر فيه: `Initial admin password:` — انسخ الباسورد.

3. سجل دخول بـ:
   - **Username:** `admin`
   - **Password:** الباسورد اللي نسختها

4. **غيّر الباسورد فورًا** من إعدادات الحساب.

---

## كيف تعمل تعديلات بعد النشر

### الطريقة الأسهل (من جهازك):

1. عدّل الكود على جهازك
2. ارفع التعديلات لـ GitHub:
```bash
git add .
git commit -m "وصف التعديل"
git push
```

3. ادخل على السيرفر وحدّث:
```bash
ssh root@3dtecheg.com
cd /var/www/3dtech
git pull
npm install        # لو أضفت حزم جديدة
npm run build      # لو عدلت في الـ frontend
pm2 restart 3dtech
```

### أمر سريع (سطر واحد للتحديث):

```bash
ssh root@3dtecheg.com "cd /var/www/3dtech && git pull && npm install && npm run build && pm2 restart 3dtech"
```

---

## أوامر مفيدة للصيانة

```bash
# حالة التطبيق
pm2 status

# اللوجات المباشرة
pm2 logs 3dtech

# إعادة تشغيل
pm2 restart 3dtech

# استخدام الذاكرة والـ CPU
pm2 monit

# مسح اللوجات
pm2 flush
```

---

## حماية إضافية (اختياري لكن مُستحسن)

### 1. Fail2Ban (حماية من محاولات الاختراق)

```bash
dnf install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

إعداد حماية Nginx:

```bash
nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

```bash
systemctl restart fail2ban
```

### 2. تحديثات أمنية تلقائية

```bash
dnf install dnf-automatic -y
nano /etc/dnf/automatic.conf
```

غيّر `apply_updates = yes`، وبعدين:

```bash
systemctl enable --now dnf-automatic.timer
```

### 3. تغيير منفذ SSH (اختياري)

```bash
nano /etc/ssh/sshd_config
```

غيّر `Port 22` إلى رقم تاني (مثلاً `Port 2222`)، وبعدين:

```bash
firewall-cmd --permanent --add-port=2222/tcp
firewall-cmd --permanent --remove-service=ssh
firewall-cmd --reload
systemctl restart sshd
```

بعدها هتتصل بالسيرفر كده: `ssh -p 2222 root@3dtecheg.com`

### 4. النسخ الاحتياطي

التطبيق فيه نظام نسخ احتياطي مدمج عن طريق PM2 (بيشتغل يوميًا الساعة 2 الصبح).

للنسخ الاحتياطي اليدوي:

```bash
cp /var/www/3dtech/server/data.db /var/www/3dtech/server/backups/manual-$(date +%Y%m%d).db
```

---

## ملخص الحماية المدمجة في الموقع

الموقع فيه بالفعل:
- تشفير JWT مع مفتاح عشوائي آمن
- حماية من CSRF/XSS (Helmet CSP + DOMPurify)
- تحديد عدد الطلبات (Rate Limiting)
- تحديد محاولات تسجيل الدخول
- تحقق من أنواع الملفات المرفوعة (Magic Bytes)
- حماية Honeypot للنماذج
- تشفير كلمات المرور بـ bcrypt (cost 12)
- نظام صلاحيات متقدم (RBAC)
- API Keys مع تشفير SHA-256

مع SSL + Firewall + Fail2Ban، الموقع هيكون محمي بشكل ممتاز.
