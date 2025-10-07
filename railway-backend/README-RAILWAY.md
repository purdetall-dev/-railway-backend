# 🚀 PurDetall Backend - Railway Deployment

## Deploy Automático en Railway

### 1. Preparar Railway

1. Ve a [railway.app](https://railway.app)
2. Crea cuenta (gratis)
3. Click "New Project" → "Deploy from GitHub repo"

### 2. Subir Código

```bash
# Crear repositorio
git init
git add .
git commit -m "PurDetall backend for Railway"

# Subir a GitHub
git remote add origin https://github.com/tu-usuario/purdetall-backend
git push -u origin main
```

### 3. Configurar Variables de Entorno

En Railway Dashboard → Settings → Variables:

```
JWT_SECRET=purdetall_super_secret_key_123456789
NODE_ENV=production
CORS_ORIGINS=https://tu-sitio.netlify.app
```

### 4. Deploy Automático

Railway detectará automáticamente Node.js y desplegará.

**Tu API estará en**: `https://tu-proyecto.railway.app`

## ⚙️ Configuración Post-Deploy

### Crear Usuario Admin:

```bash
# En Railway Console o localmente:
npm run create-admin
```

**Credenciales default**:
- Usuario: `admin`
- Contraseña: `purdetall2025`

### Endpoints del API:

- **Admin Panel**: `https://tu-api.railway.app/admin`
- **API**: `https://tu-api.railway.app/api/*`
- **Servicios**: `https://tu-api.railway.app/api/services`
- **Galería**: `https://tu-api.railway.app/api/gallery`

## 🔗 Conectar con Netlify

1. **Copia la URL de Railway**
2. **Actualiza frontend**: Edita `netlify-deploy/public/js/main-netlify.js`
3. **Cambia**: `https://tu-backend-url.com` por tu URL de Railway

## ✅ Testing

Prueba que funciona:
```bash
curl https://tu-proyecto.railway.app/api/services
```

## 🎯 Resultado Final

- ✅ **Frontend**: Netlify
- ✅ **Backend**: Railway  
- ✅ **Panel Admin**: Completamente funcional
- ✅ **Base de datos**: SQLite en Railway
- ✅ **API**: Endpoints completos

¡Panel admin activado! 🚀