# Bot de Discord - Sistema de Puntos y Sorteos

## Estado del Proyecto
**Última actualización:** 30 de Septiembre, 2025

Bot de Discord completamente funcional con sistema de puntos, niveles, roles automáticos, sorteos, y comandos personalizables.

## Nuevas Funcionalidades Implementadas

### 1. Sistema VIP Configurable con Gestión Automática
- **Rol VIP:** Configurable mediante `!admin configurar rol_vip @rol`
- **Multiplicador VIP:** Los usuarios con rol VIP ganan más puntos (configurable)
- **Aplica a:** Mensajes, tiempo en canales de voz, y claim diario
- **Bonus de bienvenida:** 2000 puntos automáticos al recibir el rol VIP
- **Duración automática:** El rol VIP se remueve automáticamente después de 30 días
- **Comando para configurar multiplicador:** `!admin configurar multiplicador_vip <número>`

### 2. Comando de Claim Diario
- **Comando:** `!claim`
- **Cooldown:** 24 horas
- **Puntos configurables:** `!admin configurar claim_diario <cantidad>`
- **Bonus VIP:** Los usuarios VIP reciben el multiplicador aplicado también al claim (ej: 2x = doble de puntos)
- **Persistencia:** Los datos se guardan en `claims.json`

### 3. Panel de Ajustes Expandido
Todos los ajustes son configurables mediante comandos:
- `!admin configurar puntos_mensaje <valor>` - Puntos por mensaje
- `!admin configurar puntos_voz <valor>` - Puntos por minuto en voz
- `!admin configurar multiplicador <valor>` - Multiplicador de EXP
- `!admin configurar rol_vip @rol` - Configurar rol VIP
- `!admin configurar multiplicador_vip <valor>` - Multiplicador para VIPs
- `!admin configurar claim_diario <valor>` - Puntos por claim diario
- `!admin configurar ip <texto>` - Mensaje personalizado del servidor
- `!admin configurar prefijo <símbolo>` - Cambiar prefijo de comandos

## Arquitectura del Proyecto

### Archivos Principales
- `index.js` - Código principal del bot
- `config.json` - Configuración del bot (roles, ajustes, comandos personalizados)
- `data.json` - Datos de puntos y niveles de usuarios
- `claims.json` - Registro de claims diarios
- `sorteo.json` - Estado del sorteo actual

### Características Técnicas
- **Puerto:** 5000 (servidor HTTP de estado)
- **Framework:** Discord.js v14
- **Node.js:** v20.x
- **Persistencia:** Archivos JSON

## Comandos Disponibles

### Para Usuarios
- `!puntos` - Ver tus puntos y nivel
- `!claim` - Reclamar puntos diarios (cada 24h)
- `!top` - Ver ranking de usuarios
- `!perfil [@usuario]` - Ver perfil
- `!ip` - Ver información del servidor
- `!help` - Ver todos los comandos

### Para Administradores
- `!admin dar @usuario <puntos>` - Dar puntos
- `!admin quitar @usuario <puntos>` - Quitar puntos
- `!admin reset @usuario` - Reset usuario
- `!admin configurar <ajuste> <valor>` - Configurar bot
- `!admin ver_config` - Ver configuración actual
- `!admin comando crear/editar/eliminar/lista` - Gestionar comandos personalizados
- `!setrol <nivel> @rol` - Asignar rol por nivel
- `!verroles` - Ver roles configurados
- `!clear [cantidad]` - Borrar mensajes

### Sorteos (Admin)
- `!sorteo crear <costo> <premio>` - Crear sorteo
- `!sorteo ver` - Ver sorteo actual
- `!sorteo finalizar` - Finalizar y elegir ganador

## Configuración Actual del Servidor
La configuración se puede ver en cualquier momento con `!admin ver_config`

## Notas Importantes
- El bot se reinicia automáticamente al cambiar dependencias
- Los datos se guardan automáticamente en archivos JSON
- El token de Discord está seguro en variables de entorno
- El servidor HTTP en puerto 5000 muestra el estado del bot

## Próximas Mejoras Sugeridas
- Estadísticas de claims (total reclamado, rachas)
- Sistema de recompensas por rachas de claims consecutivos
- Notificaciones automáticas cuando el claim esté disponible
- Sistema de logros y badges
- Exportación de estadísticas en formato CSV
