const mysql = require('mysql2/promise');
const passwords = ['', 'root', 'password', '123456', 'admin', 'mysql'];

async function test() {
  for (const pwd of passwords) {
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: pwd
      });
      console.log('✅ SUCCESS! Password is: "' + pwd + '"');
      await conn.end();
      process.exit(0);
    } catch (err) {
      console.log('❌ Failed with password: "' + pwd + '"');
    }
  }
  console.log('None worked. MySQL password is unknown.');
}
test();
