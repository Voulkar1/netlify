import { run, get } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { todayStr, weekRange, currentMonthKey } from '../src/dateUtils.js';

const DEMO_PASSWORD = 'ChangeMe123!';

async function main() {
  const existing = await get('SELECT COUNT(*)::int as c FROM users');
  if (existing.c > 0) {
    console.log('Database already has users — skipping seed. Wipe the users table to reseed.');
    return;
  }

  console.log('Seeding demo data...');

  await run('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [
    'Admin',
    'admin@example.com',
    hashPassword(DEMO_PASSWORD),
    'ADMIN',
  ]);

  const managerResult = await run(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    ['Manager', 'manager@example.com', hashPassword(DEMO_PASSWORD), 'MANAGER']
  );
  const managerId = managerResult.rows[0].id;

  const demoEmployees = [
    { name: 'Ana Torres', title: 'Support Agent', email: 'ana@example.com' },
    { name: 'Luis Gomez', title: 'Support Agent', email: 'luis@example.com' },
    { name: 'Priya Patel', title: 'Team Lead', email: 'priya@example.com' },
    { name: 'Marco Diaz', title: 'Support Agent', email: 'marco@example.com' },
    { name: 'Sofia Reyes', title: 'Support Agent', email: 'sofia@example.com' },
  ];

  const employeeIds = [];
  for (let i = 0; i < demoEmployees.length; i++) {
    const emp = demoEmployees[i];
    const result = await run(
      'INSERT INTO employees (name, title, email, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [emp.name, emp.title, emp.email, i]
    );
    const id = result.rows[0].id;
    employeeIds.push(id);
    await run(
      'INSERT INTO users (name, email, password_hash, role, employee_id) VALUES ($1, $2, $3, $4, $5)',
      [emp.name, emp.email, hashPassword(DEMO_PASSWORD), 'EMPLOYEE', id]
    );
  }

  // Sample schedule: this week, a mix of statuses so the grid/report aren't empty.
  const week = weekRange(todayStr());
  const pattern = [
    ['ON', 'ON', 'ON', 'ON', 'ON', 'OFF', 'OFF'],
    ['ON', 'ON', 'OFF', 'ON', 'ON', 'ON', 'OFF'],
    ['ON', 'ON', 'ON', 'HOLIDAY', 'ON', 'OFF', 'OFF'],
    ['LATE', 'ON', 'ON', 'ON', 'MIA', 'OFF', 'OFF'],
    ['ON', 'OFF', 'OFF', 'ON', 'ON', 'ON', 'ON'],
  ];

  for (let idx = 0; idx < employeeIds.length; idx++) {
    const empId = employeeIds[idx];
    for (let dayIdx = 0; dayIdx < week.length; dayIdx++) {
      const date = week[dayIdx];
      const status = pattern[idx][dayIdx];
      await run(
        'INSERT INTO schedule_entries (employee_id, date, status, updated_by) VALUES ($1, $2, $3, $4)',
        [empId, date, status, managerId]
      );
    }
  }

  await run(
    'INSERT INTO monthly_notes (month, content, created_by, created_by_name) VALUES ($1, $2, $3, $4)',
    [
      currentMonthKey(),
      'Welcome! This is where you post schedule changes for the month (shift swaps, temporary coverage, upcoming holidays, etc.). This board clears automatically next month.',
      managerId,
      'Manager',
    ]
  );

  console.log('\nSeed complete. Demo logins (password for all: ' + DEMO_PASSWORD + '):');
  console.log('  Admin:    admin@example.com');
  console.log('  Manager:  manager@example.com');
  demoEmployees.forEach((e) => console.log(`  Employee: ${e.email}  (${e.name})`));
  console.log('\nChange these passwords before using this in production.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
