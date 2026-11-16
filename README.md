# 🐾 VetVision

Asistente de diagnóstico por imágenes para médicos veterinarios (perros y gatos).
El veterinario sube fotos de una lesión, la IA (Claude, con visión) propone el diagnóstico más probable, los diferenciales, las pruebas y el tratamiento orientativo. Después, el veterinario puede conversar con la IA sobre el caso.

> ⚠️ Herramienta de **apoyo**. El diagnóstico y la prescripción final son responsabilidad del médico veterinario. El modelo no está validado clínicamente.

## Funcionalidades

- Inicio de sesión y registro de veterinarios (Supabase Auth)
- Nuevo caso con los datos del paciente y de 1 a 5 imágenes (arrastrar, galería o cámara; HEIC convertido automáticamente)
- Análisis con IA en JSON estructurado: hallazgos, diagnóstico y confianza, diferenciales, pruebas, tratamiento, urgencia
- Detección de imágenes no válidas (borrosas, sin animal, etc.)
- Revisión del veterinario: confirmar o corregir el diagnóstico, el tratamiento y las notas
- **Chat clínico** con el contexto completo del caso, respuestas en streaming, atajos, imágenes de seguimiento y resumen automático de conversaciones largas
- Historial con búsqueda y filtros (especie, fechas, diagnóstico)
- Informe PDF generado en el navegador, con la opción de incluir el chat
- Seguridad: Row Level Security en todas las tablas y en Storage; la clave de la IA vive solo en el servidor

## Estructura

```
vetvision/
├── app/
│   ├── layout.tsx, globals.css, page.tsx
│   ├── login/page.tsx                 # login / registro
│   ├── casos/page.tsx                 # historial con filtros
│   ├── casos/nuevo/page.tsx           # formulario de nuevo caso
│   ├── casos/[id]/page.tsx            # resultados + revisión + chat + PDF
│   └── api/
│       ├── casos/route.ts             # POST crear caso
│       ├── casos/[id]/route.ts        # PATCH revisión · DELETE caso
│       ├── analizar/route.ts          # POST análisis con Claude (tool use → JSON)
│       └── chat/route.ts              # POST chat clínico (streaming)
├── components/                        # UI (formulario, uploader, resultados, chat, PDF…)
├── lib/
│   ├── prompts.ts                     # prompts de sistema: análisis, chat y resumen
│   ├── caso-servidor.ts               # imágenes → base64, URLs firmadas, contexto del caso
│   ├── imagen.ts                      # HEIC→JPEG y redimensionado en el navegador
│   ├── anthropic.ts, constantes.ts, types.ts
│   └── supabase/ (server.ts, client.ts)
├── middleware.ts                      # sesión y protección de rutas
└── supabase/schema.sql                # tablas, RLS, bucket y políticas de Storage
```

## Puesta en marcha en local

**Requisitos:** Node.js 20 o superior, una cuenta en [Supabase](https://supabase.com) y una clave de la API de Claude ([console.anthropic.com](https://console.anthropic.com)).

1. **Instala las dependencias**
   ```bash
   npm install
   ```
2. **Crea un proyecto en Supabase.** En *SQL Editor*, pega y ejecuta el archivo `supabase/schema.sql`. Esto crea las tablas, el RLS, el bucket privado `imagenes-casos` y sus políticas.
   - Para hacer pruebas, puedes desactivar la confirmación por email en *Authentication → Providers → Email*.
3. **Configura las variables de entorno**
   ```bash
   cp .env.example .env.local
   ```
   Rellena `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (en *Project Settings → API*) y `ANTHROPIC_API_KEY`.
   `ANTHROPIC_MODEL` es opcional; por defecto se usa `claude-sonnet-5-5`.
4. **Arranca el servidor**
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000, crea una cuenta y registra tu primer caso.

## Despliegue en Vercel

1. Sube el repositorio a GitHub e impórtalo en [vercel.com](https://vercel.com).
2. Añade las mismas variables de entorno en *Settings → Environment Variables*.
3. En Supabase, en *Authentication → URL Configuration*, añade la URL de Vercel como *Site URL*.
4. Despliega. Las rutas de IA tienen `maxDuration = 60` s. En el plan Hobby de Vercel ese es el máximo, y suele bastar.

Las imágenes se suben directamente del navegador a Supabase Storage (protegidas por RLS). Así se evita el límite de unos 4,5 MB por petición de las funciones serverless.

## Personalización

- **Prompts:** `lib/prompts.ts`. Ahí se ajustan las especialidades, el estilo, las reglas de seguridad farmacológica o el formato.
- **Zonas del cuerpo y estilos:** `lib/constantes.ts`.
- **Tamaño de la ventana del chat antes de resumir:** `VENTANA` en `app/api/chat/route.ts`.
- **Colores:** la paleta `clinico` en `tailwind.config.ts`.

## Próximos pasos sugeridos

- Pantalla de perfil (nombre, clínica, colegiatura) para el encabezado del PDF
- Varias visitas por paciente, con una línea de tiempo de la evolución
- Valoración de cada respuesta de la IA (👍/👎) para medir su precisión
- Validación con casos reales confirmados por histopatología o cultivo antes de usarlo en clínica
