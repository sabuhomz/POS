import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../config/database.js'
import crypto from 'node:crypto'
import nodemailer from 'nodemailer'

const otpHash = (code) => crypto.createHash('sha256').update(`${process.env.OTP_SECRET || process.env.JWT_SECRET}:${code}`).digest('hex')
const isGmail = (email) => /^[^\s@]+@gmail\.com$/i.test(email)

async function sendOtp(email, code) {
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPassword = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '')
  if (!smtpUser || !smtpPassword) {
    const error = new Error('ระบบส่งอีเมลยังไม่ได้ตั้งค่า กรุณาตั้งค่า SMTP_USER และ SMTP_APP_PASSWORD ใน backend')
    error.status = 503
    throw error
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPassword }
  })
  try {
    await transporter.sendMail({
      from: `POS Password Recovery <${smtpUser}>`,
      to: email,
      subject: 'รหัสยืนยันสำหรับกู้คืนรหัสผ่าน POS',
      text: `รหัส OTP ของคุณคือ ${code} รหัสนี้หมดอายุใน 10 นาที และใช้สำหรับผูกอีเมล/กู้คืนรหัสผ่านเท่านั้น หากคุณไม่ได้ทำรายการนี้ สามารถละเว้นอีเมลนี้ได้`
    })
  } catch (cause) {
    const error = new Error('ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ Gmail แล้วลองอีกครั้ง')
    error.status = 503
    error.cause = cause
    throw error
  }
}

async function createOtp(email, userId, purpose) {
  const recent = await query(`SELECT created_at FROM recovery_email_codes
    WHERE user_id IS NOT DISTINCT FROM $1 AND purpose=$2 AND created_at>NOW()-INTERVAL '60 seconds'
    LIMIT 1`, [userId, purpose])
  if (recent.rowCount) {
    const error = new Error('กรุณารอ 1 นาทีก่อนขอรหัสใหม่')
    error.status = 429
    throw error
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
  await query('DELETE FROM recovery_email_codes WHERE (user_id=$1 OR (user_id IS NULL AND $1 IS NULL)) AND purpose=$2', [userId, purpose])
  await query(`INSERT INTO recovery_email_codes (user_id,email,purpose,code_hash,expires_at)
    VALUES ($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')`, [userId, email, purpose, otpHash(code)])
  try { await sendOtp(email, code) } catch (error) {
    await query('DELETE FROM recovery_email_codes WHERE user_id IS NOT DISTINCT FROM $1 AND purpose=$2', [userId, purpose])
    throw error
  }
}

async function validateOtp(email, userId, purpose, code) {
  const found = await query(`SELECT id,code_hash,attempts FROM recovery_email_codes
    WHERE email=$1 AND user_id IS NOT DISTINCT FROM $2 AND purpose=$3 AND expires_at>NOW()
    ORDER BY created_at DESC LIMIT 1`, [email, userId, purpose])
  const row = found.rows[0]
  if (!row || row.attempts >= 5) return false
  const valid = crypto.timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(otpHash(code), 'hex'))
  if (!valid) await query('UPDATE recovery_email_codes SET attempts=attempts+1 WHERE id=$1', [row.id])
  else await query('DELETE FROM recovery_email_codes WHERE id=$1', [row.id])
  return valid
}

export async function recoveryEmail(req, res, next) {
  try {
    const result = await query('SELECT recovery_email,recovery_email_verified_at FROM users WHERE id=$1', [req.user.sub])
    res.json({ email: result.rows[0]?.recovery_email || null, verified: Boolean(result.rows[0]?.recovery_email_verified_at) })
  } catch (error) { next(error) }
}

export async function requestRecoveryEmailCode(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!isGmail(email)) return res.status(400).json({ message: 'กรุณาใช้ Gmail ที่ลงท้ายด้วย @gmail.com' })
    const duplicate = await query('SELECT id FROM users WHERE LOWER(recovery_email)=$1 AND recovery_email_verified_at IS NOT NULL AND id<>$2', [email, req.user.sub])
    if (duplicate.rowCount) return res.status(409).json({ message: 'Gmail นี้ผูกกับบัญชีอื่นแล้ว' })
    await createOtp(email, req.user.sub, 'LINK')
    res.json({ message: 'ส่งรหัสยืนยันไปยัง Gmail แล้ว' })
  } catch (error) { next(error) }
}

export async function verifyRecoveryEmail(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const code = String(req.body.code || '').trim()
    if (!isGmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ message: 'กรุณาตรวจสอบ Gmail และรหัส 6 หลัก' })
    const valid = await validateOtp(email, req.user.sub, 'LINK', code)
    if (!valid) return res.status(400).json({ message: 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่' })
    await query('UPDATE users SET recovery_email=$1,recovery_email_verified_at=NOW(),updated_at=NOW() WHERE id=$2', [email, req.user.sub])
    res.json({ message: 'ผูก Gmail สำหรับกู้คืนรหัสผ่านสำเร็จ', email })
  } catch (error) { next(error) }
}

export async function requestPasswordReset(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (isGmail(email)) {
      const result = await query('SELECT id FROM users WHERE LOWER(recovery_email)=$1 AND recovery_email_verified_at IS NOT NULL AND is_active=TRUE LIMIT 1', [email])
      if (result.rowCount) await createOtp(email, result.rows[0].id, 'RESET')
    }
    res.json({ message: 'ถ้า Gmail นี้ผูกกับบัญชีที่ใช้งานได้ ระบบจะส่งรหัสกู้คืนให้' })
  } catch (error) { next(error) }
}

export async function resetPassword(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const code = String(req.body.code || '').trim()
    const password = String(req.body.newPassword || '')
    if (!isGmail(email) || !/^\d{6}$/.test(code) || password.length < 8) return res.status(400).json({ message: 'กรุณาตรวจสอบข้อมูล และตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร' })
    const result = await query('SELECT id FROM users WHERE LOWER(recovery_email)=$1 AND recovery_email_verified_at IS NOT NULL AND is_active=TRUE LIMIT 1', [email])
    const user = result.rows[0]
    if (!user || !(await validateOtp(email, user.id, 'RESET', code))) return res.status(400).json({ message: 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่' })
    const hash = await bcrypt.hash(password, 12)
    await query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [hash, user.id])
    res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ เข้าสู่ระบบได้เลย' })
  } catch (error) { next(error) }
}

export async function login(req, res, next) {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' })

    const result = await query(`SELECT id, username, password_hash, role, store_id, is_active FROM users WHERE username=$1 LIMIT 1`, [username])
    const user = result.rows[0]
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid username or password' })
    }
    if (user.role === 'OWNER') {
      const store = await query('SELECT status FROM stores WHERE id=$1', [user.store_id])
      if (!store.rowCount || store.rows[0].status !== 'ACTIVE') return res.status(403).json({ message: 'Store is not active' })
    }

    const permissions = user.role === 'ADMIN' ? ['*'] : (await query('SELECT permission_key FROM user_permissions WHERE user_id=$1', [user.id])).rows.map(r => r.permission_key)
    const payload = { sub: String(user.id), username: user.username, role: user.role, storeId: user.store_id, permissions }
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' })
    res.json({ accessToken, user: { id:user.id, username:user.username, role:user.role, storeId:user.store_id, permissions } })
  } catch (e) { next(e) }
}

export async function me(req, res, next) {
  try {
    const result = await query('SELECT id,username,role,store_id,is_active FROM users WHERE id=$1', [req.user.sub])
    if (!result.rowCount || !result.rows[0].is_active) return res.status(401).json({ message:'User inactive or not found' })
    const u=result.rows[0]
    const permissions=u.role==='ADMIN'?['*']:(await query('SELECT permission_key FROM user_permissions WHERE user_id=$1',[u.id])).rows.map(r=>r.permission_key)
    res.json({user:{id:u.id,username:u.username,role:u.role,storeId:u.store_id,permissions}})
  } catch(e){next(e)}
}

export async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body.currentPassword || '')
    const newPassword = String(req.body.newPassword || '')
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' })
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' })
    }

    const result = await query(
      'SELECT password_hash FROM users WHERE id=$1 AND is_active=TRUE',
      [req.user.sub]
    )
    if (!result.rowCount || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
      return res.status(400).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await query(
      'UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',
      [passwordHash, req.user.sub]
    )
    return res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
  } catch (error) {
    next(error)
  }
}
