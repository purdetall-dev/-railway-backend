const bcrypt = require('bcryptjs');
const db = require('./database/init');

// Script para crear el usuario administrador inicial
async function createAdminUser() {
    const username = 'admin';
    const email = 'admin@purdetall.es';
    const password = 'purdetall2025'; // CAMBIAR en producción
    
    try {
        // Verificar si ya existe un usuario admin
        db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, existingUser) => {
            if (err) {
                console.error('Error checking existing user:', err);
                return;
            }
            
            if (existingUser) {
                console.log('ℹ️  Usuario administrador ya existe');
                console.log('Username: admin');
                console.log('Password: purdetall2025');
                console.log('⚠️  IMPORTANTE: Cambiar la contraseña en producción');
                return;
            }
            
            // Crear nuevo usuario admin
            const hashedPassword = await bcrypt.hash(password, 12);
            
            db.run(
                'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                [username, email, hashedPassword, 'admin'],
                function(err) {
                    if (err) {
                        console.error('❌ Error creating admin user:', err);
                    } else {
                        console.log('✅ Usuario administrador creado correctamente');
                        console.log('='.repeat(50));
                        console.log('CREDENCIALES DE ACCESO AL PANEL ADMIN:');
                        console.log('='.repeat(50));
                        console.log(`URL: http://localhost:3000/admin`);
                        console.log(`Username: ${username}`);
                        console.log(`Password: ${password}`);
                        console.log('='.repeat(50));
                        console.log('⚠️  IMPORTANTE: Cambiar la contraseña una vez dentro del panel');
                        console.log('='.repeat(50));
                    }
                    process.exit(0);
                }
            );
        });
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    createAdminUser();
}

module.exports = createAdminUser;