import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';

/**
 * GET /api/employees
 */
export async function listEmployees(req, res, next) {
  try {
    const result = await query(
      `
      SELECT
        id,
        first_name,  -- เพิ่มตรงนี้
        last_name,   -- เพิ่มตรงนี้
        username,
        role,
        store_id,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE store_id = $1
        AND role = 'EMPLOYEE'
      ORDER BY id DESC
      `,
      [req.user.storeId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/employees
 */
export async function createEmployee(req, res, next) {
  try {
    const firstName = String(req.body.first_name || '').trim(); // รับชื่อจริง
    const lastName = String(req.body.last_name || '').trim();   // รับนามสกุล
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อ, นามสกุล, Username, Password)'
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (!req.user.storeId) {
      return res.status(400).json({ message: 'Owner is not associated with a store' });
    }

    // ตรวจ username ซ้ำ
    const existing = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username]);
    if (existing.rowCount) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `
      INSERT INTO users (
        first_name,
        last_name,
        username,
        password_hash,
        role,
        store_id,
        is_active
      )
      VALUES ($1, $2, $3, $4, 'EMPLOYEE', $5, TRUE)
      RETURNING *
      `,
      [firstName, lastName, username, passwordHash, req.user.storeId]
    );

    res.status(201).json({
      message: 'Employee account created successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username already exists' });
    }
    next(error);
  }
}

/**
 * PUT /api/employees/:id
 */
export async function updateEmployee(req, res, next) {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const firstName = req.body.first_name !== undefined ? String(req.body.first_name).trim() : null;
    const lastName = req.body.last_name !== undefined ? String(req.body.last_name).trim() : null;
    const username = req.body.username !== undefined ? String(req.body.username).trim() : null;
    const password = req.body.password !== undefined ? String(req.body.password) : null;

    if (username !== null && username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }
    if (password !== null && password.length < 8 && password.length > 0) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await query(
      `SELECT id, first_name, last_name, username FROM users WHERE id = $1 AND store_id = $2 AND role = 'EMPLOYEE' LIMIT 1`,
      [employeeId, req.user.storeId]
    );

    if (!existing.rowCount) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const newFirstName = firstName ?? existing.rows[0].first_name;
    const newLastName = lastName ?? existing.rows[0].last_name;
    const newUsername = username ?? existing.rows[0].username;

    if (username && username !== existing.rows[0].username) {
      const duplicate = await query(
        `SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
        [username, employeeId]
      );
      if (duplicate.rowCount) {
        return res.status(409).json({ message: 'Username already exists' });
      }
    }

    let result;
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      result = await query(
        `UPDATE users SET first_name = $1, last_name = $2, username = $3, password_hash = $4, updated_at = NOW() WHERE id = $5 AND store_id = $6 AND role = 'EMPLOYEE' RETURNING *`,
        [newFirstName, newLastName, newUsername, passwordHash, employeeId, req.user.storeId]
      );
    } else {
      result = await query(
        `UPDATE users SET first_name = $1, last_name = $2, username = $3, updated_at = NOW() WHERE id = $4 AND store_id = $5 AND role = 'EMPLOYEE' RETURNING *`,
        [newFirstName, newLastName, newUsername, employeeId, req.user.storeId]
      );
    }

    res.json({ message: 'Employee updated successfully', employee: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username already exists' });
    }
    next(error);
  }
}

/**
 * PATCH /api/employees/:id/status
 *
 * Disable / Enable employee
 *
 * ใช้ soft delete เพื่อไม่ทำลายประวัติการขายในอนาคต
 */
export async function updateEmployeeStatus(req, res, next) {
  try {
    const employeeId = Number(req.params.id)
    const isActive = Boolean(req.body.is_active)

    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({
        message: 'Invalid employee id'
      })
    }

    const result = await query(
      `
      UPDATE users
      SET
        is_active = $1,
        updated_at = NOW()
      WHERE id = $2
        AND store_id = $3
        AND role = 'EMPLOYEE'
      RETURNING
        id,
        username,
        role,
        store_id,
        is_active,
        updated_at
      `,
      [
        isActive,
        employeeId,
        req.user.storeId
      ]
    )

    if (!result.rowCount) {
      return res.status(404).json({
        message: 'Employee not found'
      })
    }

    res.json({
      message: isActive
        ? 'Employee enabled successfully'
        : 'Employee disabled successfully',
      employee: result.rows[0]
    })
  } catch (error) {
    next(error)
  }
}
// ฟังก์ชันสำหรับลบข้อมูลพนักงาน
/**
 * DELETE /api/employees/:id
 *
 * ลบพนักงานออกจากระบบถาวร
 */
export async function deleteEmployee(req, res, next) {
  try {
    const employeeId = Number(req.params.id);
    const storeId = req.user.storeId; 

    // เช็คว่า id ที่ส่งมาเป็นตัวเลขที่ถูกต้องหรือไม่
    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({
        message: 'Invalid employee id'
      });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 AND store_id = $2 RETURNING id',
      [employeeId, storeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        message: 'ไม่พบพนักงาน หรือคุณไม่มีสิทธิ์ลบบัญชีนี้' 
      });
    }

    res.status(200).json({ message: 'ลบข้อมูลพนักงานสำเร็จ' });
  } catch (error) {
    next(error); // โยน error ให้ Express จัดการ (เหมือนฟังก์ชันอื่นๆ ในไฟล์)
  }
}