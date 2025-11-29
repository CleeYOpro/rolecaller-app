const http = require('http');
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// Load DATABASE_URL
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  try {
    const env = fs.readFileSync('./.env', 'utf8');
    const m = env.match(/DATABASE_URL\s*=\s*['"]?(.*?)['"]?$/m);
    if (m) DATABASE_URL = m[1];
  } catch (e) {
    // ignore
  }
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

// Use a Pool instead of a single Client for better stability and auto-reconnection
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Handle unexpected pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // process.exit(-1); // Don't exit, just log. Pool handles reconnection.
});

async function seedDefaultData(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const client = await pool.connect().catch(e => null);
    if (!client) {
      console.error(`Failed to connect to DB (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      continue;
    }

    try {
      // Check if schools table exists and is empty, then seed default school
      const res = await client.query('SELECT count(*) FROM schools');
      const count = parseInt(res.rows[0].count);
      console.log(`Schools in database: ${count}`);

      if (count === 0) {
        console.log('Seeding default school...');
        // Use UUID for the school ID to match Drizzle schema
        const insertResult = await client.query(`
              INSERT INTO schools (id, name, email, password, address)
              VALUES (gen_random_uuid(), 'Greenwood High', 'admin@greenwood.edu', 'password', '123 Main St')
              RETURNING id, name, email
          `);
        console.log('✅ Default school seeded successfully:', insertResult.rows[0]);
      } else {
        // Show existing schools
        const existingSchools = await client.query('SELECT id, name, email FROM schools LIMIT 5');
        console.log('✅ Schools already exist:', existingSchools.rows);
      }
      client.release();
      return; // Success
    } catch (err) {
      console.error(`Failed to seed data (attempt ${i + 1}/${retries}):`, err.message);
      client.release();
      await new Promise(res => setTimeout(res, delay));
    }
  }
  console.warn('Could not seed default data, but continuing anyway...');
}

// Seed default data on startup (schema is managed by Drizzle)
seedDefaultData();

// Helper to send JSON
const sendJSON = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    // --- SCHOOLS ---
    if (path === '/schools' && method === 'GET') {
      try {
        console.log('Fetching schools from database...');
        const result = await pool.query(`
          SELECT id, name, email, address, created_at as "createdAt"
          FROM schools
          ORDER BY created_at DESC
        `);
        console.log(`Found ${result.rows.length} schools`);
        return sendJSON(res, 200, result.rows);
      } catch (err) {
        console.error('Error fetching schools:', err);
        return sendJSON(res, 500, { error: 'Failed to fetch schools: ' + err.message });
      }
    }

    if (path === '/login' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { email, password } = JSON.parse(body);
          const result = await pool.query('SELECT * FROM schools WHERE email = $1', [email]);
          if (result.rows.length === 0) {
            return sendJSON(res, 404, { error: 'School not found' });
          }
          const school = result.rows[0];
          // Check password
          if (school.password !== password) {
            return sendJSON(res, 401, { error: 'Invalid password' });
          }
          // Don't return password in response
          const { password: _, ...schoolWithoutPassword } = school;
          return sendJSON(res, 200, schoolWithoutPassword);
        } catch (err) {
          console.error('Login error:', err);
          return sendJSON(res, 500, { error: 'Login failed' });
        }
      });
      return;
    }

    // --- CLASSES ---
    if (path === '/classes' && method === 'GET') {
      try {
        const schoolId = url.searchParams.get('schoolId');
        if (!schoolId) return sendJSON(res, 400, { error: 'Missing schoolId' });

        const resultClean = await pool.query(`
          SELECT id, name, school_id as "schoolId", created_at as "createdAt"
          FROM classes 
          WHERE school_id = $1
          ORDER BY name ASC
        `, [schoolId]);
        return sendJSON(res, 200, resultClean.rows);
      } catch (err) {
        console.error('Error fetching classes:', err);
        return sendJSON(res, 500, { error: 'Failed to fetch classes' });
      }
    }

    if (path === '/classes' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const { name, schoolId } = JSON.parse(body);
        // Use UUID for class ID to match Drizzle schema
        const result = await pool.query(
          'INSERT INTO classes (id, name, school_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id, name, school_id as "schoolId"',
          [name, schoolId]
        );
        return sendJSON(res, 201, result.rows[0]);
      });
      return;
    }

    if (path === '/classes' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      await pool.query('DELETE FROM classes WHERE id = $1', [id]);
      return sendJSON(res, 200, { success: true });
    }

    // --- STUDENTS ---
    if (path === '/students' && method === 'GET') {
      const schoolId = url.searchParams.get('schoolId');
      const classId = url.searchParams.get('classId');

      let query = `
                SELECT id, name, class_id as "classId", school_id as "schoolId", grade, created_at as "createdAt"
                FROM students WHERE school_id = $1
            `;
      const params = [schoolId];

      if (classId) {
        query += ` AND class_id = $2`;
        params.push(classId);
      }

      const result = await pool.query(query, params);
      return sendJSON(res, 200, result.rows);
    }

    if (path === '/students' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const { name, classId, schoolId, grade } = JSON.parse(body);
        // Use UUID for student ID
        const result = await pool.query(
          'INSERT INTO students (id, name, class_id, school_id, grade) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id',
          [name, classId, schoolId, grade || '']
        );
        return sendJSON(res, 201, { success: true, id: result.rows[0].id });
      });
      return;
    }

    if (path === '/students/bulk' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const students = JSON.parse(body); // Expects array of { name, id, grade, class, schoolId }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          for (const s of students) {
            // 1. Ensure Class Exists (if class name provided)
            let classId = s.classId;
            if (s.class && !classId) {
              // Check if class exists by name for this school
              const classRes = await client.query(
                'SELECT id FROM classes WHERE school_id = $1 AND name = $2',
                [s.schoolId, s.class]
              );
              if (classRes.rows.length > 0) {
                classId = classRes.rows[0].id;
              } else {
                // Create class with UUID
                const classResult = await client.query(
                  'INSERT INTO classes (id, name, school_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id',
                  [s.class, s.schoolId]
                );
                classId = classResult.rows[0].id;
              }
            }

            // 2. Insert Student (use UUID for id)
            await client.query(`
              INSERT INTO students (id, name, class_id, school_id, grade)
              VALUES (gen_random_uuid(), $1, $2, $3, $4)
            `, [s.name, classId, s.schoolId, s.grade || s.standard || '']);
          }

          await client.query('COMMIT');
          return sendJSON(res, 200, { success: true });
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Bulk upload error', err);
          return sendJSON(res, 500, { error: 'Bulk upload failed: ' + err.message });
        } finally {
          client.release();
        }
      });
      return;
    }

    if (path === '/students' && method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { id, name, classId, schoolId, grade } = JSON.parse(body);
          await pool.query(`
            UPDATE students 
            SET name = $1, class_id = $2, school_id = $3, grade = $4
            WHERE id = $5
          `, [name, classId, schoolId, grade, id]);
          return sendJSON(res, 200, { success: true });
        } catch (err) {
          console.error('Update student error', err);
          return sendJSON(res, 500, { error: 'Update failed: ' + err.message });
        }
      });
      return;
    }

    if (path === '/students' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      await pool.query('DELETE FROM students WHERE id = $1', [id]);
      return sendJSON(res, 200, { success: true });
    }

    // --- ATTENDANCE ---
    if (path === '/attendance' && method === 'GET') {
      try {
        const classId = url.searchParams.get('classId');
        const date = url.searchParams.get('date'); // YYYY-MM-DD

        if (!classId || !date) {
          return sendJSON(res, 400, { error: 'Missing classId or date' });
        }

        const result = await pool.query(`
          SELECT student_id, status 
          FROM attendance 
          WHERE class_id = $1 AND date = $2
        `, [classId, date]);

        // Transform to map: { studentId: status }
        const map = {};
        result.rows.forEach(row => {
          map[row.student_id] = row.status;
        });
        return sendJSON(res, 200, map);
      } catch (err) {
        console.error('Error fetching attendance:', err);
        return sendJSON(res, 500, { error: 'Failed to fetch attendance' });
      }
    }

    // Get all attendance for a class (for stats)
    if (path === '/attendance/all' && method === 'GET') {
      try {
        const classId = url.searchParams.get('classId');
        if (!classId) {
          return sendJSON(res, 400, { error: 'Missing classId' });
        }

        const result = await pool.query(`
          SELECT student_id, date, status 
          FROM attendance 
          WHERE class_id = $1
          ORDER BY date DESC
        `, [classId]);

        // Transform to nested map: { date: { studentId: status } }
        const map = {};
        result.rows.forEach(row => {
          const dateStr = row.date.toString().split('T')[0]; // Ensure date is in YYYY-MM-DD format
          if (!map[dateStr]) map[dateStr] = {};
          map[dateStr][row.student_id] = row.status;
        });
        return sendJSON(res, 200, map);
      } catch (err) {
        console.error('Error fetching all attendance:', err);
        return sendJSON(res, 500, { error: 'Failed to fetch attendance' });
      }
    }

    if (path === '/attendance' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { studentId, classId, date, status } = JSON.parse(body);

          if (!studentId || !classId || !date || !status) {
            return sendJSON(res, 400, { error: 'Missing required fields' });
          }

          // Upsert attendance (using UUID for id, conflict on student_id + date)
          await pool.query(`
            INSERT INTO attendance (id, student_id, class_id, date, status, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
            ON CONFLICT (student_id, date) 
            DO UPDATE SET 
              status = EXCLUDED.status,
              updated_at = NOW()
          `, [studentId, classId, date, status]);

          return sendJSON(res, 200, { success: true });
        } catch (err) {
          console.error('Error marking attendance:', err);
          return sendJSON(res, 500, { error: 'Failed to mark attendance: ' + err.message });
        }
      });
      return;
    }

    sendJSON(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('Server error:', err);
    sendJSON(res, 500, { error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please kill the process running on this port or set a different PORT.`);
    process.exit(1);
  } else {
    console.error('Server error:', e);
  }
});

server.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});