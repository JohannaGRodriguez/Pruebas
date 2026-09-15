# Conexion M365 para CMR Comercial

Esta conexion sigue el patron publicado en `Eternet.M365.IntegrationTools`:

- app corporativa delegada: `Eternet Graph Tools`;
- Tenant ID: `ecd40e14-b48a-4861-9586-38cdc9ee127d`;
- Client ID: `8a10a0c2-e04a-4f32-8e62-233180baaee8`;
- sin client secret;
- sin application permissions;
- token en memoria del proceso local;
- Browser UI -> backend local -> Microsoft Graph.

## Fuente configurada

La fuente configurada es la lista indicada para Bajas:

- Hostname: `eternet.sharepoint.com`
- Sitio: `/sites/RecuperodeBajas`
- Lista: `Solicitudes de baja`
- Vista de origen: `https://eternet.sharepoint.com/sites/RecuperodeBajas/Lists/Solicitudes%20de%20baja/AllItems.aspx`
- Año cargado por defecto: `2026`

El servidor no transforma ni inventa campos. Devuelve los campos crudos de SharePoint dentro de `fields` y filtra por `Fecha` para traer solo solicitudes 2026.

## Endpoints locales

Con el servidor local iniciado:

- `POST /api/m365/auth/start`
- `GET /api/m365/auth/status`
- `GET /api/m365/me`
- `GET /api/sharepoint/bajas/metadata`
- `GET /api/sharepoint/bajas/items?year=2026`

## Ejecucion

1. Copiar `m365.env.example` a `.env` si se quiere ajustar algun valor.
2. Instalar dependencias de Node.
3. Ejecutar `npm run start:m365`.
4. Abrir `http://localhost:8787`.
5. Iniciar login llamando `POST /api/m365/auth/start`.
6. Completar el device code con la cuenta corporativa.
7. Consultar `GET /api/sharepoint/bajas/items`.

## Permisos usados

Segun la documentacion del repo de Eternet, para SharePoint/Listas el MVP usa:

- `User.Read`
- `Sites.ReadWrite.All`
- `offline_access`

Si la Enterprise App no esta habilitada para el usuario o faltan permisos, el login o la lectura de Graph va a devolver el error correspondiente.
