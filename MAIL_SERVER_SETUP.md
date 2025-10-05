# QuizTheSpire Mail Server Setup Guide

## 🎉 Congratulations! Your Mail Server is Configured!

Your Raspberry Pi is now running a complete mail server stack for **quizthespire.duckdns.org**

---

## 📋 Current Setup

### Installed Components
- ✅ **Postfix** - SMTP server (sending/receiving mail)
- ✅ **Dovecot** - IMAP server (accessing mail)
- ✅ **Roundcube** - Webmail interface
- ✅ **Let's Encrypt** - SSL/TLS certificates

### Active Services
- **SMTP (receiving)**: Port 25/TCP
- **SMTP (sending)**: Port 587/TCP with STARTTLS
- **IMAP**: Port 993/TCP with SSL/TLS
- **Webmail**: https://quizthespire.duckdns.org/roundcube
- **Apache**: Ports 80/443

### Email Account Created
- **Address**: mailadmin@quizthespire.duckdns.org
- **Password**: 6669Mario
- **Mailbox**: /home/mailadmin/Maildir/

---

## ⚠️ CRITICAL: Next Steps to Complete Setup

### 1. Contact Your ISP (REQUIRED)
**Port 25 is currently BLOCKED by your ISP!**

Your server won't be able to **receive** emails from the internet until this is resolved.

**What to do:**
1. Call your ISP's technical support
2. Request: "Please unblock incoming TCP port 25 for SMTP mail server"
3. Explain it's for a personal mail server project
4. They may ask you to upgrade to a business plan

**Test if it's unblocked:**
```bash
nmap -p 25 portquiz.net
```
If it shows `open` instead of `filtered`, you're good!

---

### 2. Configure DNS Records (REQUIRED)

Go to your **DuckDNS** account and add these DNS records:

#### MX Record (Mail Exchanger)
Tells other mail servers where to send your emails.

**DuckDNS Configuration:**
- Log into https://www.duckdns.org
- Unfortunately, DuckDNS doesn't support MX records directly
- **Solution**: Use a DNS service that supports MX records (like Cloudflare DNS, Hurricane Electric DNS, or upgrade to a paid DNS service)

**Or use a workaround:**
- You can use your current setup for **sending** emails only
- For receiving, you'd need to either:
  - Move to a DNS provider with MX record support
  - Use an email forwarding service

#### SPF Record (Sender Policy Framework)
Prevents others from spoofing your domain.

**Add TXT record:**
```
Name: @
Value: v=spf1 mx ip4:YOUR_PUBLIC_IP ~all
```

Replace `YOUR_PUBLIC_IP` with your actual public IP address.

**Find your public IP:**
```bash
curl ifconfig.me
```

---

## 🌐 Access Your Webmail

**URL**: https://quizthespire.duckdns.org/roundcube

**Login credentials:**
- Username: `mailadmin@quizthespire.duckdns.org` (or just `mailadmin`)
- Password: `6669Mario`

---

## 📧 Creating Additional Email Users

To create more email accounts:

```bash
# Create user
sudo adduser --gecos "User Full Name" --disabled-password username

# Set password
echo "username:PASSWORD_HERE" | sudo chpasswd

# Create mailbox
sudo -u username mkdir -p /home/username/Maildir/{new,cur,tmp}
```

The email address will be: `username@quizthespire.duckdns.org`

---

## 📱 Configure Email Clients

You can also use desktop/mobile email clients (Thunderbird, Outlook, Apple Mail, etc.):

### IMAP Settings (Receiving Mail)
- **Server**: quizthespire.duckdns.org
- **Port**: 993
- **Security**: SSL/TLS
- **Username**: mailadmin@quizthespire.duckdns.org
- **Password**: 6669Mario

### SMTP Settings (Sending Mail)
- **Server**: quizthespire.duckdns.org
- **Port**: 587
- **Security**: STARTTLS
- **Authentication**: Yes (same username/password)

---

## 🔒 Security Hardening (Recommended)

### Install SpamAssassin
Filters spam emails:
```bash
sudo apt install -y spamassassin spamc
sudo systemctl enable spamassassin
sudo systemctl start spamassassin
```

### Install Fail2Ban
Blocks brute-force login attempts:
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Configure Firewall
```bash
# Allow necessary ports
sudo ufw allow 25/tcp
sudo ufw allow 587/tcp
sudo ufw allow 993/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 📊 Monitoring & Logs

### Check Mail Logs
```bash
# Postfix (SMTP) logs
sudo tail -f /var/log/mail.log

# Dovecot (IMAP) logs
sudo tail -f /var/log/dovecot.log

# Apache logs
sudo tail -f /var/log/apache2/error.log
```

### Check Service Status
```bash
sudo systemctl status postfix
sudo systemctl status dovecot
sudo systemctl status apache2
```

### Test Mail Sending (from command line)
```bash
echo "Test email body" | mail -s "Test Subject" your_other_email@gmail.com
```

---

## 🛠️ Troubleshooting

### Webmail won't load
```bash
sudo systemctl restart apache2
sudo chown -R www-data:www-data /var/lib/roundcube
```

### Can't login to webmail
- Verify user exists: `id mailadmin`
- Check password: `sudo passwd mailadmin`
- Check Dovecot: `sudo systemctl status dovecot`

### Can't send emails
- Check Postfix: `sudo systemctl status postfix`
- View logs: `sudo tail -f /var/log/mail.log`
- Test SMTP: `telnet localhost 587`

### Can't receive emails
- **First**: Verify port 25 is unblocked by ISP
- Check MX records are configured
- Check Postfix is listening: `sudo netstat -tlnp | grep :25`

---

## 📝 Configuration File Locations

- **Postfix main config**: `/etc/postfix/main.cf`
- **Dovecot config**: `/etc/dovecot/dovecot.conf` and `/etc/dovecot/conf.d/`
- **Roundcube config**: `/etc/roundcube/config.inc.php`
- **SSL certificates**: `/etc/letsencrypt/live/quizthespire.duckdns.org/`
- **Apache sites**: `/etc/apache2/sites-enabled/`

---

## 🚀 What Works Right Now

✅ **Webmail interface** - Access at https://quizthespire.duckdns.org/roundcube
✅ **IMAP access** - Configure email clients to read mail
✅ **SMTP authentication** - Send emails through port 587
✅ **SSL/TLS encryption** - Secure connections with Let's Encrypt
✅ **User management** - Create email accounts easily

## ⏳ What Needs Action

❌ **Port 25 unblocking** - Contact ISP tomorrow
❌ **MX record setup** - Requires DNS provider with MX support (DuckDNS limitation)
❌ **SPF record** - Add to DNS to improve deliverability

---

## 🎯 Competing with Gmail Checklist

To truly compete with Gmail, you'll eventually want:

- [ ] Port 25 unblocked by ISP
- [ ] MX records properly configured
- [ ] SPF records set up
- [ ] DKIM signing configured (improves deliverability)
- [ ] DMARC policy set up (prevents spoofing)
- [ ] SpamAssassin installed and tuned
- [ ] Regular backups of mail directories
- [ ] Monitoring and alerting system
- [ ] Reverse DNS (PTR record) configured
- [ ] IP reputation management

---

## 📞 Support

If you run into issues:
1. Check the logs first
2. Verify services are running
3. Test network connectivity
4. Review configuration files

**Useful commands:**
```bash
# Restart everything
sudo systemctl restart postfix dovecot apache2

# Check all mail-related services
sudo systemctl status postfix dovecot apache2 | grep Active

# View real-time mail log
sudo tail -f /var/log/mail.log
```

---

**Created**: October 5, 2025
**Server**: Raspberry Pi 5
**Domain**: quizthespire.duckdns.org
**Status**: Configured (pending port 25 unblock and DNS records)
