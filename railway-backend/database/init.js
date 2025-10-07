const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Crear directorio de base de datos si no existe
const dbDir = path.dirname(process.env.DB_PATH || './database/purdetall.db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(process.env.DB_PATH || './database/purdetall.db');

// Habilitar foreign keys
db.run('PRAGMA foreign_keys = ON');

// Crear tablas
db.serialize(() => {
  // Tabla de usuarios administradores
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de configuración del sitio
  db.run(`
    CREATE TABLE IF NOT EXISTS site_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      type TEXT DEFAULT 'text',
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de servicios
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      short_description TEXT,
      price_from DECIMAL(10,2),
      image_url TEXT,
      is_active BOOLEAN DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      seo_title TEXT,
      seo_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de galería
  db.run(`
    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      before_image TEXT,
      after_image TEXT,
      service_id INTEGER,
      is_featured BOOLEAN DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services (id)
    )
  `);

  // Tabla de clientes
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      total_appointments INTEGER DEFAULT 0,
      total_spent DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de citas
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT NOT NULL,
      service_id INTEGER,
      service_name TEXT,
      vehicle_make TEXT,
      vehicle_model TEXT,
      vehicle_year INTEGER,
      vehicle_color TEXT,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      price DECIMAL(10,2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (service_id) REFERENCES services (id)
    )
  `);

  // Tabla de presupuestos
  db.run(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT,
      vehicle_make TEXT,
      vehicle_model TEXT,
      vehicle_year INTEGER,
      services TEXT, -- JSON array de servicios solicitados
      message TEXT,
      status TEXT DEFAULT 'pending',
      quote_amount DECIMAL(10,2),
      admin_notes TEXT,
      valid_until DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de blog
  db.run(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT,
      excerpt TEXT,
      featured_image TEXT,
      is_published BOOLEAN DEFAULT 0,
      author TEXT DEFAULT 'PurDetall',
      tags TEXT, -- JSON array
      seo_title TEXT,
      seo_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de noticias
  db.run(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT,
      excerpt TEXT,
      featured_image TEXT,
      is_published BOOLEAN DEFAULT 0,
      author TEXT DEFAULT 'PurDetall',
      category TEXT,
      seo_title TEXT,
      seo_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insertar configuración inicial
  const defaultConfig = [
    ['site_name', 'PurDetall', 'text', 'Nombre del sitio web'],
    ['site_description', 'Detailing de vehículos profesional en El Vendrell, Tarragona. Servicios de lavado, encerado, protección y personalización de coches.', 'textarea', 'Descripción del sitio'],
    ['site_keywords', 'detailing, coches, el vendrell, tarragona, lavado, encerado, protección, personalización', 'text', 'Palabras clave SEO'],
    ['contact_phone', '629780331', 'text', 'Teléfono de contacto'],
    ['contact_email', 'info@purdetall.es', 'email', 'Email de contacto'],
    ['contact_address', 'El Vendrell, Tarragona', 'text', 'Dirección de contacto'],
    ['whatsapp_number', '629780331', 'text', 'Número de WhatsApp'],
    ['whatsapp_message', 'Hola, me gustaría solicitar información sobre sus servicios de detailing', 'textarea', 'Mensaje predeterminado de WhatsApp'],
    ['hero_title', 'MEJORAR | PROTEGER | MANTENER | PERSONALIZAR', 'text', 'Título principal del hero'],
    ['hero_subtitle', 'PurDetall nació de la pasión por los coches y su presentación. Creado para redefinir cómo los propietarios de vehículos deben mantener la apariencia de sus coches.', 'textarea', 'Subtítulo del hero'],
    ['about_title', 'Sobre PurDetall', 'text', 'Título de la sección Acerca de'],
    ['about_content', 'PurDetall es el especialista más exclusivo en detailing y protección de pintura de vehículos en El Vendrell, Tarragona. Nuestras instalaciones de última generación albergan a algunos de los detailers más hábiles del mundo. Este entorno, junto con nuestra experiencia, nos permite ofrecer a nuestros clientes la más alta calidad posible.', 'textarea', 'Contenido de la sección Acerca de'],
    ['facebook_url', '', 'url', 'URL de Facebook'],
    ['instagram_url', '', 'url', 'URL de Instagram'],
    ['youtube_url', '', 'url', 'URL de YouTube'],
    ['google_analytics', '', 'textarea', 'Código de Google Analytics'],
    ['business_hours', 'Lunes a Viernes: 9:00 - 18:00\nSábados: 9:00 - 14:00\nDomingos: Cerrado', 'textarea', 'Horarios de atención']
  ];

  defaultConfig.forEach(([key, value, type, description]) => {
    db.run(
      'INSERT OR IGNORE INTO site_config (key, value, type, description) VALUES (?, ?, ?, ?)',
      [key, value, type, description]
    );
  });

  // Insertar servicios por defecto
  const defaultServices = [
    {
      title: 'Mejora',
      description: 'Nuestros servicios exclusivos de detailing ofrecen todo el espectro de tratamientos para la restauración, mejora, preservación y mantenimiento continuo.',
      short_description: 'Restauración y mejora completa de tu vehículo',
      price_from: 150.00,
      sort_order: 1
    },
    {
      title: 'Protección',
      description: 'Con nuestro diseño personalizado de película de protección de pintura podemos cubrir cualquier superficie pintada, fibra de carbono o acabado liso del coche.',
      short_description: 'Protección avanzada para la pintura de tu vehículo',
      price_from: 300.00,
      sort_order: 2
    },
    {
      title: 'Mantenimiento',
      description: 'Nuestros lavados de mantenimiento son una parte crucial para mantener la integridad de tu tratamiento.',
      short_description: 'Mantenimiento regular para preservar los tratamientos',
      price_from: 50.00,
      sort_order: 3
    },
    {
      title: 'Personalización',
      description: 'Nuestros servicios internos de cabina de pintura y acabados interiores permiten posibilidades ilimitadas cuando se trata de personalizar tu coche.',
      short_description: 'Personalización completa según tus gustos',
      price_from: 200.00,
      sort_order: 4
    }
  ];

  defaultServices.forEach(service => {
    db.run(
      'INSERT OR IGNORE INTO services (title, description, short_description, price_from, sort_order) VALUES (?, ?, ?, ?, ?)',
      [service.title, service.description, service.short_description, service.price_from, service.sort_order]
    );
  });

  console.log('✅ Base de datos inicializada correctamente');
});

module.exports = db;