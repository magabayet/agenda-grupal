# AgendaGrupal reconect

Una aplicación web para coordinar fechas entre grupos de amigos. Encuentra el día perfecto para reunirte con tu grupo.

**Demo en vivo:** [https://planificador-grupal.web.app](https://planificador-grupal.web.app)

## Funcionalidades

- **Autenticación con Google** - Inicia sesión de forma segura con tu cuenta de Google
- **Crear/Unirse a grupos** - Crea grupos con códigos únicos de 6 caracteres o únete con un código
- **Calendario interactivo** - Marca los días que estás disponible con un solo clic
- **Sistema semáforo** - Visualiza la disponibilidad del grupo:
  - 🟢 Verde: 100% disponible
  - 🟡 Amarillo: ≥50% disponible
  - 🔴 Rojo: <50% disponible
- **Notas por día** - Deja mensajes en fechas específicas (ej: "Puedo pero llegaría tarde")
- **Favoritos** - Marca tus fechas preferidas con estrellas
- **Filtros** - Filtra por disponibilidad, favoritos o colores
- **Compartir** - Invita amigos por email o comparte el código del grupo
- **Tiempo real** - Los cambios se sincronizan instantáneamente entre todos los miembros

## Capturas de pantalla

| Login | Grupos | Calendario |
|-------|--------|------------|
| Inicia sesión con Google | Crea o únete a grupos | Marca tu disponibilidad |

## Tecnologías

- **Frontend:** React 19, Vite 7, Tailwind CSS 4
- **Backend:** Firebase (Authentication, Firestore, Hosting)
- **Iconos:** lucide-react

## Instalación local

### Prerequisitos

- Node.js 18+
- npm
- Firebase CLI (`npm install -g firebase-tools`)

### Pasos

1. Clona el repositorio:
```bash
git clone https://github.com/magabayet/agenda-grupal.git
cd agenda-grupal
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

4. Abre [http://localhost:5173](http://localhost:5173)

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción (genera `/dist`) |
| `npm run preview` | Preview del build de producción |
| `npm run lint` | Ejecutar ESLint |

## Despliegue

La app está desplegada en Firebase Hosting. Para desplegar cambios:

```bash
npm run build
firebase deploy --only hosting
```

## Estructura del proyecto

```
mi-agenda-grupal/
├── src/
│   ├── App.jsx        # Componente principal (toda la lógica)
│   ├── main.jsx       # Punto de entrada
│   └── index.css      # Estilos globales (Tailwind)
├── public/            # Assets estáticos
├── firebase.json      # Configuración de Firebase Hosting
├── vite.config.js     # Configuración de Vite
└── package.json
```

## Modelo de datos (Firestore)

### Colección `users/{uid}`
```javascript
{
  displayName: "Miguel",
  email: "miguel@gmail.com",
  photoURL: "https://...",
  groups: ["ABC123", "XYZ789"],
  createdAt: "2025-01-01T00:00:00.000Z"
}
```

### Colección `calendar_groups/{groupId}`
```javascript
{
  name: "Reunión amigos",
  description: "Para el asado del mes",
  members: [{ uid, name, photoURL }],
  votes: { "2025-01-15": ["uid1", "uid2"] },
  messages: { "2025-01-15": { "uid1": "Llego tarde" } },
  stars: { "2025-01-15": ["uid1"] },
  createdAt: "2025-01-01T00:00:00.000Z"
}
```

## Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## Licencia

MIT

## Autor

Desarrollado por [@magabayet](https://github.com/magabayet)
