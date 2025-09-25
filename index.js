import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import fs from "fs";
import http from "http";

// === SERVIDOR HTTP PARA RENDER ===
const PORT = process.env.PORT || 3000;

// Declarar variables ANTES del servidor para poder usarlas
let data = { puntos: {}, niveles: {} };
let client; // Declaramos pero no creamos aún

const server = http.createServer((req, res) => {
  // Página básica para mostrar estado del bot
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bot Discord - Estado</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial; margin: 40px; background: #2c2f33; color: white; }
          .status { padding: 20px; background: #23272a; border-radius: 8px; }
          .online { color: #43b581; }
          .offline { color: #f04747; }
        </style>
      </head>
      <body>
        <div class="status">
          <h1>🤖 Bot de Puntos y Sorteos</h1>
          <h2>Estado: <span class="${client?.user ? 'online' : 'offline'}">${client?.user ? '🟢 ONLINE' : '🔴 OFFLINE'}</span></h2>
          <p><strong>Bot:</strong> ${client?.user?.tag || 'Conectando...'}</p>
          <p><strong>Servidores:</strong> ${client?.guilds?.cache.size || 0}</p>
          <p><strong>Usuarios totales:</strong> ${Object.keys(data.puntos).length}</p>
          <p><strong>Último reinicio:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <h3>📋 Comandos principales:</h3>
          <ul>
            <li><code>!help</code> - Ver todos los comandos</li>
            <li><code>!puntos</code> - Ver tus puntos</li>
            <li><code>!top</code> - Ranking</li>
            <li><code>!admin dar @usuario 100</code> - Dar puntos (admin)</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  } 
  else if (req.url === '/status') {
    // API endpoint para verificar estado
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: client?.user ? 'online' : 'offline',
      bot: client?.user?.tag || null,
      guilds: client?.guilds?.cache.size || 0,
      users: Object.keys(data.puntos).length,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 - Página no encontrada');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP corriendo en puerto ${PORT}`);
});
// === FIN SERVIDOR HTTP ===

// AHORA SÍ creamos el cliente UNA SOLA VEZ
client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,  // Para detectar entrada/salida de voz
    GatewayIntentBits.GuildMembers       // Para obtener información de miembros
  ],
});

// Continúa con el resto del código original...
let config = { 
  levelRoles: {},
  ajustes: {
    puntosporMensaje: 1,
    puntosporVoz: 1,
    multiplicadorExp: 1,
    prefijo: "!",
    canalAnuncios: null,
    rolAdmin: null,
    mensajeIP: "🌐 **Información del Servidor**\nIP: No configurada\nUsa `!admin configurar ip <texto>` para personalizar este mensaje."
  },
  comandosPersonalizados: {}
};
// ... resto igual
let sorteo = { activo: false, premio: "", costoPorParticipacion: 0, participantes: {} };

if (fs.existsSync("data.json")) {
  const loadedData = JSON.parse(fs.readFileSync("data.json"));
  data = { puntos: loadedData.puntos || {}, niveles: loadedData.niveles || {} };
}
if (fs.existsSync("sorteo.json")) {
  const loadedSorteo = JSON.parse(fs.readFileSync("sorteo.json"));
  sorteo = { 
    activo: loadedSorteo.activo || false, 
    premio: loadedSorteo.premio || "", 
    costoPorParticipacion: loadedSorteo.costoPorParticipacion || 0,
    participantes: loadedSorteo.participantes || {} 
  };
}
if (fs.existsSync("config.json")) {
  const loadedConfig = JSON.parse(fs.readFileSync("config.json"));
  config = { 
    levelRoles: loadedConfig.levelRoles || {},
    ajustes: {
      puntosporMensaje: loadedConfig.ajustes?.puntosporMensaje || 1,
      puntosporVoz: loadedConfig.ajustes?.puntosporVoz || 1,
      multiplicadorExp: loadedConfig.ajustes?.multiplicadorExp || 1,
      prefijo: loadedConfig.ajustes?.prefijo || "!",
      canalAnuncios: loadedConfig.ajustes?.canalAnuncios || null,
      rolAdmin: loadedConfig.ajustes?.rolAdmin || null,
      mensajeIP: loadedConfig.ajustes?.mensajeIP || "🌐 **Información del Servidor**\nIP: No configurada\nUsa `!admin configurar ip <texto>` para personalizar este mensaje."
    },
    comandosPersonalizados: loadedConfig.comandosPersonalizados || {}
  };
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}
function saveConfig() {
  fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
}
function saveSorteo() {
  fs.writeFileSync("sorteo.json", JSON.stringify(sorteo, null, 2));
}

function getLevel(puntos) {
  return Math.floor(Math.sqrt(puntos) / 2);
}

async function checkLevelUp(userId, msg) {
  let puntos = data.puntos[userId] || 0;
  let oldLevel = data.niveles[userId] || 0;
  let newLevel = getLevel(puntos);

  if (newLevel > oldLevel) {
    data.niveles[userId] = newLevel;
    saveData();

    const embed = new EmbedBuilder()
      .setColor("#00FF00")
      .setTitle("✨ ¡Nivel alcanzado! ✨")
      .setDescription(`🎉 <@${userId}> ha subido al **Nivel ${newLevel}**!`)
      .setTimestamp();

    msg.channel.send({ embeds: [embed] });

    const guild = msg.guild;
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    for (let lvl in config.levelRoles) {
      if (newLevel >= parseInt(lvl)) {
        let roleId = config.levelRoles[lvl];
        let role = guild.roles.cache.get(roleId);
        if (role) {
          for (let oldRoleId of Object.values(config.levelRoles)) {
            if (member.roles.cache.has(oldRoleId) && oldRoleId !== roleId) {
              await member.roles.remove(oldRoleId).catch(() => {});
            }
          }
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => {});
            msg.channel.send(
              `🔰 <@${userId}> ha conseguido el rol **${role.name}** por llegar al Nivel ${newLevel}!`
            );
          }
        }
      }
    }
  }
}

client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  let userId = msg.author.id;
  if (!data.puntos[userId]) data.puntos[userId] = 0;
  if (!data.niveles[userId]) data.niveles[userId] = 0;

  data.puntos[userId] += config.ajustes.puntosporMensaje;
  saveData();
  checkLevelUp(userId, msg);
});

// Voice channel monitoring disabled - requires privileged intents
// Users earn points only through messages for now

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const args = msg.content.split(" ");
  const cmd = args[0].toLowerCase();

  if (cmd === "!help" || cmd === "!ayuda" || cmd === "!comandos") {
    const embed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("📋 Comandos del Bot de Puntos y Sorteos")
      .setDescription("Lista completa de comandos disponibles")
      .addFields(
        { 
          name: "👤 **Comandos para Usuarios**", 
          value: `
          \`!puntos\` - Ver tus puntos y nivel
          \`!top\` - Ranking de usuarios
          \`!perfil [@usuario]\` - Ver perfil (tuyo o de otro)
          \`!sorteo participar <puntos>\` - Participar en sorteo
          \`!sorteo ver\` - Ver sorteo actual
          \`!sorteo mis_participaciones\` - Ver tus participaciones
          `, 
          inline: false 
        },
        { 
          name: "⚙️ **Comandos para Administradores**", 
          value: `
          \`!setrol <nivel> @rol\` - Configurar rol por nivel
          \`!verroles\` - Ver roles configurados
          \`!admin dar @usuario <puntos>\` - Dar puntos
          \`!admin quitar @usuario <puntos>\` - Quitar puntos
          \`!admin reset @usuario\` - Reset usuario
          \`!admin reset all\` - Reset todos los datos
          \`!admin configurar <ajuste> <valor>\` - Configurar bot
          \`!admin ver_config\` - Ver configuración actual
          \`!admin comando crear/editar/eliminar/lista\` - Gestionar comandos personalizados
          \`!clear [cantidad]\` - Borrar mensajes del canal (máx 100)
          \`!ip\` - Mostrar información personalizada del servidor
          `, 
          inline: false 
        },
        { 
          name: "🎲 **Sorteos (Admin)**", 
          value: `
          \`!sorteo crear <costo> <premio>\` - Crear sorteo
          \`!sorteo finalizar\` - Finalizar y elegir ganador
          `, 
          inline: false 
        },
        { 
          name: "💡 **Información Adicional**", 
          value: `
          • Ganas **${config.ajustes.puntosporMensaje} punto(s)** por mensaje
          • Los niveles se calculan automáticamente
          • Puedes gastar puntos en sorteos
          • Los admins pueden configurar todo desde Discord
          `, 
          inline: false 
        }
      )
      .setFooter({ text: `Bot configurado para ${msg.guild.name}` })
      .setTimestamp();

    msg.reply({ embeds: [embed] });
    return;
  }

  if (cmd === "!ip") {
    const embed = new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle("📡 Información del Servidor")
      .setDescription(config.ajustes.mensajeIP)
      .setFooter({ text: `Solicitado por: ${msg.author.username}` })
      .setTimestamp();

    msg.reply({ embeds: [embed] });
    return;
  }

  if (cmd === "!puntos") {
    let userId = msg.author.id;
    let score = data.puntos[userId] || 0;
    let level = data.niveles[userId] || 0;
    msg.reply(`Tienes **${score} puntos** y eres **Nivel ${level}**.`);
  }

  if (cmd === "!top") {
    let sorted = Object.entries(data.puntos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (sorted.length === 0) {
      msg.reply("Todavía no hay puntos en el ranking.");
      return;
    }

    let ranking = "";
    const emojis = ["🥇", "🥈", "🥉"];

    for (let i = 0; i < sorted.length; i++) {
      let userId = sorted[i][0];
      let score = sorted[i][1];
      let user = await client.users.fetch(userId).catch(() => null);
      let level = data.niveles[userId] || 0;
      let icon = emojis[i] || `#${i + 1}`;
      ranking += `${icon} ${user ? user.username : "Usuario desconocido"} — **${score} puntos** | 🎯 Nivel ${level}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🏆 Ranking de Puntos y Niveles 🏆")
      .setDescription(ranking)
      .setThumbnail(msg.guild.iconURL({ dynamic: true }))
      .setFooter({ text: `Servidor: ${msg.guild.name}`, iconURL: msg.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    msg.reply({ embeds: [embed] });
  }

  if (cmd === "!setrol") {
    if (!msg.member.permissions.has("Administrator")) {
      msg.reply("🚫 No tienes permisos para usar este comando.");
      return;
    }
    if (args.length < 3) {
      msg.reply("Uso: `!setrol <nivel> @rol`");
      return;
    }

    let level = parseInt(args[1]);
    let role = msg.mentions.roles.first();
    if (!role || isNaN(level)) {
      msg.reply("⚠️ Debes mencionar un rol válido y un número de nivel.");
      return;
    }

    config.levelRoles[level] = role.id;
    saveConfig();

    msg.reply(`✅ El rol **${role.name}** se asignará al alcanzar el **Nivel ${level}**.`);
  }

  if (cmd === "!verroles") {
    if (Object.keys(config.levelRoles).length === 0) {
      msg.reply("⚠️ No hay roles configurados aún.");
      return;
    }
    let texto = "📋 **Roles por nivel configurados:**\n\n";
    for (let lvl in config.levelRoles) {
      let roleId = config.levelRoles[lvl];
      let role = msg.guild.roles.cache.get(roleId);
      texto += `🔹 Nivel ${lvl} → ${role ? role.name : "Rol eliminado"}\n`;
    }
    msg.reply(texto);
  }

  if (cmd === "!perfil") {
    let user = msg.mentions.users.first() || msg.author;
    let userId = user.id;
    let score = data.puntos[userId] || 0;
    let level = data.niveles[userId] || 0;

    let roleName = "Ninguno";
    for (let lvl in config.levelRoles) {
      if (level >= parseInt(lvl)) {
        let roleId = config.levelRoles[lvl];
        let role = msg.guild.roles.cache.get(roleId);
        if (role) roleName = role.name;
      }
    }

    const embed = new EmbedBuilder()
      .setColor("#1ABC9C")
      .setTitle(`👤 Perfil de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "⭐ Puntos", value: `${score}`, inline: true },
        { name: "🎯 Nivel", value: `${level}`, inline: true },
        { name: "🔰 Rol actual", value: roleName, inline: true }
      )
      .setFooter({ text: `Servidor: ${msg.guild.name}`, iconURL: msg.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    msg.reply({ embeds: [embed] });
  }

  // SISTEMA DE ADMINISTRACIÓN Y AJUSTES
  if (cmd === "!admin") {
    if (!msg.member.permissions.has("Administrator")) {
      msg.reply("🚫 Solo los administradores pueden usar estos comandos.");
      return;
    }

    if (args.length < 2) {
      msg.reply("❓ Comandos disponibles: `dar`, `quitar`, `reset`, `configurar`, `ver_config`, `comando`");
      return;
    }

    const subcommand = args[1].toLowerCase();

    if (subcommand === "dar") {
      if (args.length < 4) {
        msg.reply("❓ Uso: `!admin dar @usuario <cantidad>`");
        return;
      }

      const usuario = msg.mentions.users.first();
      if (!usuario) {
        msg.reply("⚠️ Debes mencionar a un usuario válido.");
        return;
      }

      const cantidad = parseInt(args[3]);
      if (isNaN(cantidad) || cantidad <= 0) {
        msg.reply("⚠️ La cantidad debe ser un número mayor a 0.");
        return;
      }

      const userId = usuario.id;
      if (!data.puntos[userId]) data.puntos[userId] = 0;
      if (!data.niveles[userId]) data.niveles[userId] = 0;

      data.puntos[userId] += cantidad;
      saveData();
      
      // Verificar subida de nivel
      await checkLevelUp(userId, msg);

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("💰 Puntos Otorgados")
        .setDescription(`✅ Se han otorgado **${cantidad} puntos** a ${usuario.username}`)
        .addFields(
          { name: "👤 Usuario", value: `<@${userId}>`, inline: true },
          { name: "📊 Total puntos", value: `${data.puntos[userId]}`, inline: true },
          { name: "🎯 Nivel actual", value: `${data.niveles[userId] || 0}`, inline: true }
        )
        .setFooter({ text: `Otorgado por: ${msg.author.username}` })
        .setTimestamp();

      msg.reply({ embeds: [embed] });
    }

    else if (subcommand === "quitar") {
      if (args.length < 4) {
        msg.reply("❓ Uso: `!admin quitar @usuario <cantidad>`");
        return;
      }

      const usuario = msg.mentions.users.first();
      if (!usuario) {
        msg.reply("⚠️ Debes mencionar a un usuario válido.");
        return;
      }

      const cantidad = parseInt(args[3]);
      if (isNaN(cantidad) || cantidad <= 0) {
        msg.reply("⚠️ La cantidad debe ser un número mayor a 0.");
        return;
      }

      const userId = usuario.id;
      const puntosActuales = data.puntos[userId] || 0;
      
      if (puntosActuales < cantidad) {
        msg.reply(`❌ ${usuario.username} solo tiene **${puntosActuales}** puntos. No se pueden quitar **${cantidad}**.`);
        return;
      }

      data.puntos[userId] -= cantidad;
      data.niveles[userId] = getLevel(data.puntos[userId]);
      saveData();

      const embed = new EmbedBuilder()
        .setColor("#FF6B6B")
        .setTitle("📉 Puntos Descontados")
        .setDescription(`✅ Se han descontado **${cantidad} puntos** a ${usuario.username}`)
        .addFields(
          { name: "👤 Usuario", value: `<@${userId}>`, inline: true },
          { name: "📊 Puntos restantes", value: `${data.puntos[userId]}`, inline: true },
          { name: "🎯 Nivel actual", value: `${data.niveles[userId] || 0}`, inline: true }
        )
        .setFooter({ text: `Descontado por: ${msg.author.username}` })
        .setTimestamp();

      msg.reply({ embeds: [embed] });
    }

    else if (subcommand === "reset") {
      if (args.length < 3) {
        msg.reply("❓ Uso: `!admin reset @usuario` o `!admin reset all`");
        return;
      }

      if (args[2].toLowerCase() === "all") {
        data = { puntos: {}, niveles: {} };
        saveData();
        msg.reply("🔄 **¡Todos los datos han sido reseteados!** Todos los usuarios vuelven a 0 puntos y nivel 0.");
        return;
      }

      const usuario = msg.mentions.users.first();
      if (!usuario) {
        msg.reply("⚠️ Debes mencionar a un usuario válido o usar `all` para resetear todo.");
        return;
      }

      const userId = usuario.id;
      data.puntos[userId] = 0;
      data.niveles[userId] = 0;
      saveData();

      msg.reply(`🔄 **${usuario.username}** ha sido reseteado a **0 puntos** y **nivel 0**.`);
    }

    else if (subcommand === "configurar") {
      if (args.length < 4) {
        msg.reply("❓ Ajustes disponibles: `puntos_mensaje`, `multiplicador`, `prefijo`, `ip`\nUso: `!admin configurar <ajuste> <valor>`");
        return;
      }

      const ajuste = args[2].toLowerCase();
      const valor = args[3];

      if (ajuste === "puntos_mensaje") {
        const nuevoValor = parseInt(valor);
        if (isNaN(nuevoValor) || nuevoValor < 0) {
          msg.reply("⚠️ El valor debe ser un número mayor o igual a 0.");
          return;
        }
        config.ajustes.puntosporMensaje = nuevoValor;
        saveConfig();
        msg.reply(`✅ Puntos por mensaje configurados a: **${nuevoValor}**`);
      }

      else if (ajuste === "multiplicador") {
        const nuevoValor = parseFloat(valor);
        if (isNaN(nuevoValor) || nuevoValor <= 0) {
          msg.reply("⚠️ El multiplicador debe ser un número mayor a 0.");
          return;
        }
        config.ajustes.multiplicadorExp = nuevoValor;
        saveConfig();
        msg.reply(`✅ Multiplicador de experiencia configurado a: **${nuevoValor}x**`);
      }

      else if (ajuste === "prefijo") {
        if (valor.length > 3) {
          msg.reply("⚠️ El prefijo no puede tener más de 3 caracteres.");
          return;
        }
        config.ajustes.prefijo = valor;
        saveConfig();
        msg.reply(`✅ Prefijo del bot cambiado a: **${valor}**`);
      }

      else if (ajuste === "ip") {
        // Unir todos los argumentos a partir del tercero para permitir espacios
        const nuevoMensaje = args.slice(3).join(" ");
        if (nuevoMensaje.length < 1) {
          msg.reply("⚠️ El mensaje no puede estar vacío.");
          return;
        }
        if (nuevoMensaje.length > 1000) {
          msg.reply("⚠️ El mensaje no puede tener más de 1000 caracteres.");
          return;
        }
        config.ajustes.mensajeIP = nuevoMensaje;
        saveConfig();
        
        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle("✅ Mensaje IP Actualizado")
          .setDescription("**Nuevo mensaje:**")
          .addFields({ name: "📡 Vista previa", value: nuevoMensaje, inline: false })
          .setFooter({ text: "Los usuarios verán esto cuando usen !ip" })
          .setTimestamp();
        
        msg.reply({ embeds: [embed] });
      }

      else {
        msg.reply("❌ Ajuste no válido. Disponibles: `puntos_mensaje`, `multiplicador`, `prefijo`, `ip`");
      }
    }

    else if (subcommand === "ver_config") {
      const embed = new EmbedBuilder()
        .setColor("#4ECDC4")
        .setTitle("⚙️ Configuración Actual del Bot")
        .addFields(
          { name: "💬 Puntos por mensaje", value: `${config.ajustes.puntosporMensaje}`, inline: true },
          { name: "🔢 Multiplicador EXP", value: `${config.ajustes.multiplicadorExp}x`, inline: true },
          { name: "🎯 Prefijo", value: `${config.ajustes.prefijo}`, inline: true },
          { name: "📊 Total usuarios registrados", value: `${Object.keys(data.puntos).length}`, inline: true },
          { name: "🏆 Roles configurados", value: `${Object.keys(config.levelRoles).length}`, inline: true },
          { name: "🎲 Sorteo activo", value: sorteo.activo ? "Sí" : "No", inline: true }
        )
        .setFooter({ text: `Consultado por: ${msg.author.username}` })
        .setTimestamp();

      msg.reply({ embeds: [embed] });
    }

    else if (subcommand === "comando") {
      if (args.length < 3) {
        msg.reply("❓ Uso: `!admin comando crear/editar/eliminar/lista <nombre> [texto]`");
        return;
      }

      const accion = args[2].toLowerCase();

      if (accion === "crear" || accion === "editar") {
        if (args.length < 5) {
          msg.reply("❓ Uso: `!admin comando crear/editar <nombre_comando> <texto_respuesta...>`");
          return;
        }

        const nombreComando = args[3].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nombreComando.length < 2 || nombreComando.length > 20) {
          msg.reply("⚠️ El nombre del comando debe tener entre 2 y 20 caracteres (solo letras y números).");
          return;
        }

        // Verificar que no sea un comando existente del sistema
        const comandosSistema = ['puntos', 'top', 'perfil', 'setrol', 'verroles', 'admin', 'sorteo', 'help', 'ayuda', 'comandos', 'ip', 'clear'];
        if (comandosSistema.includes(nombreComando)) {
          msg.reply(`❌ No puedes usar **${nombreComando}** porque es un comando del sistema.`);
          return;
        }

        const textoRespuesta = args.slice(4).join(" ");
        if (textoRespuesta.length < 1 || textoRespuesta.length > 1500) {
          msg.reply("⚠️ El texto debe tener entre 1 y 1500 caracteres.");
          return;
        }

        const esNuevo = !config.comandosPersonalizados[nombreComando];
        config.comandosPersonalizados[nombreComando] = {
          texto: textoRespuesta,
          creador: msg.author.username,
          fechaCreacion: new Date().toISOString(),
          usos: config.comandosPersonalizados[nombreComando]?.usos || 0
        };
        saveConfig();

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(`✅ Comando ${esNuevo ? 'Creado' : 'Editado'}`)
          .setDescription(`Comando **!${nombreComando}** ${esNuevo ? 'creado' : 'actualizado'} exitosamente`)
          .addFields(
            { name: "📝 Vista previa", value: textoRespuesta.substring(0, 200) + (textoRespuesta.length > 200 ? "..." : ""), inline: false },
            { name: "👤 Creador", value: msg.author.username, inline: true },
            { name: "📊 Usos", value: `${config.comandosPersonalizados[nombreComando].usos}`, inline: true }
          )
          .setFooter({ text: `Usa !${nombreComando} para probarlo` })
          .setTimestamp();

        msg.reply({ embeds: [embed] });
      }

      else if (accion === "eliminar") {
        if (args.length < 4) {
          msg.reply("❓ Uso: `!admin comando eliminar <nombre_comando>`");
          return;
        }

        const nombreComando = args[3].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!config.comandosPersonalizados[nombreComando]) {
          msg.reply(`❌ El comando **!${nombreComando}** no existe.`);
          return;
        }

        delete config.comandosPersonalizados[nombreComando];
        saveConfig();
        msg.reply(`✅ El comando **!${nombreComando}** ha sido eliminado exitosamente.`);
      }

      else if (accion === "lista") {
        const comandos = Object.keys(config.comandosPersonalizados);
        if (comandos.length === 0) {
          msg.reply("📝 No hay comandos personalizados creados aún.\nUsa `!admin comando crear <nombre> <texto>` para crear uno.");
          return;
        }

        let listaComandos = "";
        comandos.forEach(cmd => {
          const info = config.comandosPersonalizados[cmd];
          listaComandos += `\`!${cmd}\` - ${info.usos} usos (por ${info.creador})\n`;
        });

        const embed = new EmbedBuilder()
          .setColor("#3498DB")
          .setTitle("📋 Comandos Personalizados")
          .setDescription(`**Total:** ${comandos.length} comando(s)`)
          .addFields({ name: "📝 Lista de comandos", value: listaComandos, inline: false })
          .setFooter({ text: "Usa !admin comando editar <nombre> <nuevo_texto> para modificar" })
          .setTimestamp();

        msg.reply({ embeds: [embed] });
      }

      else {
        msg.reply("❓ Acciones disponibles: `crear`, `editar`, `eliminar`, `lista`");
      }
    }

    else {
      msg.reply("❓ Comandos disponibles: `dar`, `quitar`, `reset`, `configurar`, `ver_config`, `comando`, `clear`");
    }
  }

  // COMANDO CLEAR (solo administradores)
  if (cmd === "!clear") {
    if (!msg.member.permissions.has("Administrator")) {
      msg.reply("🚫 Solo los administradores pueden usar este comando.");
      return;
    }

    // Obtener cantidad de mensajes a borrar (por defecto 100, máximo 100)
    let cantidad = 100;
    if (args[1]) {
      const cantidadInput = parseInt(args[1]);
      if (!isNaN(cantidadInput) && cantidadInput > 0) {
        cantidad = Math.min(cantidadInput, 100); // Discord limita a 100 mensajes por vez
      }
    }

    try {
      // Confirmar con el usuario antes de borrar
      const confirmEmbed = new EmbedBuilder()
        .setColor("#FF6B6B")
        .setTitle("⚠️ Confirmación de Borrado")
        .setDescription(`¿Estás seguro de que quieres borrar **${cantidad} mensajes** del canal ${msg.channel}?`)
        .addFields(
          { name: "📝 Uso completo", value: "`!clear [cantidad]` - cantidad opcional (1-100)", inline: false },
          { name: "⚠️ Advertencia", value: "Solo se pueden borrar mensajes de menos de 14 días", inline: false }
        )
        .setFooter({ text: "Reacciona con ✅ para confirmar o ❌ para cancelar" })
        .setTimestamp();

      const confirmMessage = await msg.reply({ embeds: [confirmEmbed] });
      
      // Agregar reacciones
      await confirmMessage.react("✅");
      await confirmMessage.react("❌");

      // Crear filtro para las reacciones
      const filter = (reaction, user) => {
        return ['✅', '❌'].includes(reaction.emoji.name) && user.id === msg.author.id;
      };

      // Esperar reacción del usuario (30 segundos)
      const collected = await confirmMessage.awaitReactions({ 
        filter, 
        max: 1, 
        time: 30000, 
        errors: ['time'] 
      }).catch(() => null);

      if (!collected) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor("#95A5A6")
          .setTitle("⏰ Tiempo agotado")
          .setDescription("Operación de borrado cancelada por timeout.")
          .setTimestamp();
        
        await confirmMessage.edit({ embeds: [timeoutEmbed] });
        return;
      }

      const reaction = collected.first();

      if (reaction.emoji.name === '❌') {
        const cancelEmbed = new EmbedBuilder()
          .setColor("#95A5A6")
          .setTitle("❌ Operación cancelada")
          .setDescription("No se borraron mensajes.")
          .setTimestamp();
        
        await confirmMessage.edit({ embeds: [cancelEmbed] });
        return;
      }

      if (reaction.emoji.name === '✅') {
        // Proceder con el borrado
        const loadingEmbed = new EmbedBuilder()
          .setColor("#F39C12")
          .setTitle("🔄 Borrando mensajes...")
          .setDescription("Por favor espera mientras se eliminan los mensajes.")
          .setTimestamp();
        
        await confirmMessage.edit({ embeds: [loadingEmbed] });

        // Obtener mensajes del canal (excluyendo el mensaje de confirmación)
        const messagesToDelete = await msg.channel.messages.fetch({ 
          limit: cantidad + 2, // +2 para el comando original y el de confirmación
          before: confirmMessage.id 
        });

        // Filtrar mensajes de menos de 14 días (limitación de Discord)
        const now = Date.now();
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        const validMessages = messagesToDelete.filter(m => now - m.createdTimestamp < fourteenDays);

        if (validMessages.size === 0) {
          const noMessagesEmbed = new EmbedBuilder()
            .setColor("#F39C12")
            .setTitle("⚠️ Sin mensajes para borrar")
            .setDescription("No se encontraron mensajes válidos para borrar (solo se pueden borrar mensajes de menos de 14 días).")
            .setTimestamp();
          
          await confirmMessage.edit({ embeds: [noMessagesEmbed] });
          return;
        }

        // Borrar mensajes en lotes (Discord limita a 100 por bulkDelete)
        const deletedCount = validMessages.size;
        await msg.channel.bulkDelete(validMessages, true);

        // Borrar también el mensaje de confirmación
        await confirmMessage.delete().catch(() => {});

        // Mensaje de éxito (se auto-borra después de 5 segundos)
        const successEmbed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle("✅ Mensajes borrados exitosamente")
          .setDescription(`Se borraron **${deletedCount}** mensajes del canal.`)
          .addFields(
            { name: "🗑️ Borrados por", value: `<@${msg.author.id}>`, inline: true },
            { name: "📍 Canal", value: `${msg.channel}`, inline: true }
          )
          .setFooter({ text: "Este mensaje se auto-borrará en 5 segundos" })
          .setTimestamp();

        const successMessage = await msg.channel.send({ embeds: [successEmbed] });
        
        // Auto-borrar el mensaje de éxito después de 5 segundos
        setTimeout(async () => {
          try {
            await successMessage.delete();
          } catch (error) {
            console.log("No se pudo auto-borrar el mensaje de éxito");
          }
        }, 5000);

        console.log(`🗑️ ${msg.author.username} borró ${deletedCount} mensajes en ${msg.channel.name}`);
      }

    } catch (error) {
      console.error(`❌ Error en comando clear: ${error.message}`);
      
      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("❌ Error al borrar mensajes")
        .setDescription(`Ocurrió un error: ${error.message}`)
        .addFields(
          { name: "💡 Posibles causas", value: "• Falta de permisos\n• Mensajes muy antiguos (>14 días)\n• Error de conexión", inline: false }
        )
        .setTimestamp();

      msg.reply({ embeds: [errorEmbed] });
    }
  }

  // SISTEMA DE SORTEOS
  if (cmd === "!sorteo") {
    if (args.length < 2) {
      msg.reply("❓ Uso: `!sorteo crear/participar/ver/finalizar/mis_participaciones`");
      return;
    }

    const subcommand = args[1].toLowerCase();

    if (subcommand === "crear") {
      if (!msg.member.permissions.has("Administrator")) {
        msg.reply("🚫 Solo los administradores pueden crear sorteos.");
        return;
      }
      if (args.length < 4) {
        msg.reply("❓ Uso: `!sorteo crear <costo_por_participacion> <premio...>`");
        return;
      }

      const costo = parseInt(args[2]);
      if (isNaN(costo) || costo <= 0) {
        msg.reply("⚠️ El costo debe ser un número mayor a 0.");
        return;
      }

      if (sorteo.activo) {
        msg.reply("⚠️ Ya hay un sorteo activo. Finalízalo primero con `!sorteo finalizar`");
        return;
      }

      const premio = args.slice(3).join(" ");
      
      sorteo = {
        activo: true,
        premio: premio,
        costoPorParticipacion: costo,
        participantes: {}
      };
      saveSorteo();

      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🎊 ¡Nuevo Sorteo Creado! 🎊")
        .setDescription(`🎁 **Premio:** ${premio}`)
        .addFields(
          { name: "💰 Costo por participación", value: `${costo} puntos`, inline: true },
          { name: "📝 Cómo participar", value: `\`!sorteo participar <puntos>\``, inline: true }
        )
        .setFooter({ text: "¡Participa gastando tus puntos!" })
        .setTimestamp();

      msg.reply({ embeds: [embed] });
    }

    else if (subcommand === "participar") {
      if (!sorteo.activo) {
        msg.reply("❌ No hay ningún sorteo activo actualmente.");
        return;
      }

      if (args.length < 3) {
        msg.reply("❓ Uso: `!sorteo participar <cantidad_puntos>`");
        return;
      }

      const cantidad = parseInt(args[2]);
      if (isNaN(cantidad) || cantidad <= 0) {
        msg.reply("⚠️ Debes especificar una cantidad válida de puntos.");
        return;
      }

      if (cantidad % sorteo.costoPorParticipacion !== 0) {
        msg.reply(`⚠️ Los puntos deben ser múltiplos de ${sorteo.costoPorParticipacion}. Ejemplo: ${sorteo.costoPorParticipacion}, ${sorteo.costoPorParticipacion * 2}, ${sorteo.costoPorParticipacion * 3}...`);
        return;
      }

      const userId = msg.author.id;
      const puntosUsuario = data.puntos[userId] || 0;

      if (puntosUsuario < cantidad) {
        msg.reply(`❌ No tienes suficientes puntos. Tienes **${puntosUsuario}** puntos y necesitas **${cantidad}**.`);
        return;
      }

      // Descontar puntos
      data.puntos[userId] -= cantidad;
      
      // Agregar participaciones
      const participaciones = cantidad / sorteo.costoPorParticipacion;
      if (!sorteo.participantes[userId]) {
        sorteo.participantes[userId] = 0;
      }
      sorteo.participantes[userId] += participaciones;

      saveData();
      saveSorteo();

      msg.reply(`✅ ¡Participación exitosa! Gastaste **${cantidad} puntos** y obtuviste **${participaciones} participaciones**. Te quedan **${data.puntos[userId]} puntos**.`);
    }

    else if (subcommand === "ver") {
      if (!sorteo.activo) {
        msg.reply("❌ No hay ningún sorteo activo actualmente.");
        return;
      }

      let participantesTexto = "";
      let totalParticipaciones = 0;

      for (let userId in sorteo.participantes) {
        const participaciones = sorteo.participantes[userId];
        totalParticipaciones += participaciones;
        const user = await client.users.fetch(userId).catch(() => null);
        participantesTexto += `🎫 ${user ? user.username : "Usuario desconocido"}: **${participaciones}** participaciones\n`;
      }

      if (participantesTexto === "") {
        participantesTexto = "Ningún participante aún.";
      }

      const embed = new EmbedBuilder()
        .setColor("#9B59B6")
        .setTitle("🎲 Sorteo Actual")
        .setDescription(`🎁 **Premio:** ${sorteo.premio}`)
        .addFields(
          { name: "💰 Costo por participación", value: `${sorteo.costoPorParticipacion} puntos`, inline: true },
          { name: "🎫 Total participaciones", value: `${totalParticipaciones}`, inline: true },
          { name: "👥 Participantes", value: participantesTexto, inline: false }
        )
        .setFooter({ text: "Usa !sorteo participar <puntos> para participar" })
        .setTimestamp();

      msg.reply({ embeds: [embed] });
    }

    else if (subcommand === "mis_participaciones") {
      if (!sorteo.activo) {
        msg.reply("❌ No hay ningún sorteo activo actualmente.");
        return;
      }

      const userId = msg.author.id;
      const misParticipaciones = sorteo.participantes[userId] || 0;
      
      msg.reply(`🎫 Tienes **${misParticipaciones}** participaciones en el sorteo actual del premio: **${sorteo.premio}**`);
    }

    else if (subcommand === "finalizar") {
      if (!msg.member.permissions.has("Administrator")) {
        msg.reply("🚫 Solo los administradores pueden finalizar sorteos.");
        return;
      }

      if (!sorteo.activo) {
        msg.reply("❌ No hay ningún sorteo activo actualmente.");
        return;
      }

      const participantesIds = Object.keys(sorteo.participantes);
      if (participantesIds.length === 0) {
        msg.reply("❌ No hay participantes en el sorteo. Sorteo cancelado.");
        sorteo = { activo: false, premio: "", costoPorParticipacion: 0, participantes: {} };
        saveSorteo();
        return;
      }

      // Crear array con todas las participaciones
      let participaciones = [];
      for (let userId in sorteo.participantes) {
        const cantidadParticipaciones = sorteo.participantes[userId];
        for (let i = 0; i < cantidadParticipaciones; i++) {
          participaciones.push(userId);
        }
      }

      // Elegir ganador aleatoriamente
      const indiceGanador = Math.floor(Math.random() * participaciones.length);
      const ganadorId = participaciones[indiceGanador];
      const ganador = await client.users.fetch(ganadorId).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("🏆 ¡GANADOR DEL SORTEO! 🏆")
        .setDescription(`🎉 **¡Felicitaciones <@${ganadorId}>!**`)
        .addFields(
          { name: "🎁 Premio ganado", value: sorteo.premio, inline: false },
          { name: "🎫 Participaciones del ganador", value: `${sorteo.participantes[ganadorId]}`, inline: true },
          { name: "👥 Total participantes", value: `${participantesIds.length}`, inline: true },
          { name: "🎲 Total participaciones", value: `${participaciones.length}`, inline: true }
        )
        .setThumbnail(ganador ? ganador.displayAvatarURL({ dynamic: true }) : null)
        .setFooter({ text: "¡Gracias a todos por participar!" })
        .setTimestamp();

      msg.reply({ embeds: [embed] });

      // Resetear sorteo
      sorteo = { activo: false, premio: "", costoPorParticipacion: 0, participantes: {} };
      saveSorteo();
    }

    else {
      msg.reply("❓ Comandos disponibles: `crear`, `participar`, `ver`, `mis_participaciones`, `finalizar`");
    }
  }

  // COMANDOS PERSONALIZADOS
  // Verificar si el comando es personalizado (sin el !)
  const nombreCmd = cmd.slice(1); // Quitar el "!" del inicio
  if (config.comandosPersonalizados[nombreCmd]) {
    // Incrementar contador de usos
    config.comandosPersonalizados[nombreCmd].usos++;
    saveConfig();

    const embed = new EmbedBuilder()
      .setColor("#9B59B6")
      .setTitle(`💬 ${nombreCmd}`)
      .setDescription(config.comandosPersonalizados[nombreCmd].texto)
      .setFooter({ 
        text: `Comando creado por: ${config.comandosPersonalizados[nombreCmd].creador} | Usos: ${config.comandosPersonalizados[nombreCmd].usos}` 
      })
      .setTimestamp();

    msg.reply({ embeds: [embed] });
  }
});

// ===============================
// SISTEMA DE PUNTOS POR VOZ
// ===============================

// Objeto para rastrear usuarios en canales de voz
let voiceTracking = {};

client.on("voiceStateUpdate", async (oldState, newState) => {
  const userId = newState.member.id;
  const username = newState.member.user.username;
  
  try {
    // Usuario ENTRA a un canal de voz (no estaba en ninguno antes)
    if (!oldState.channel && newState.channel) {
      voiceTracking[userId] = {
        startTime: Date.now(),
        channelName: newState.channel.name
      };
      console.log(`🎤 ${username} entró al canal de voz: ${newState.channel.name}`);
    }
    
    // Usuario SALE de un canal de voz (ahora no está en ninguno)
    else if (oldState.channel && !newState.channel) {
      if (voiceTracking[userId]) {
        const timeInVoice = Date.now() - voiceTracking[userId].startTime;
        const minutesInVoice = Math.floor(timeInVoice / 60000); // Convertir a minutos
        
        console.log(`🎤 ${username} salió del canal de voz: ${oldState.channel.name} (${minutesInVoice} minutos)`);
        
        // Solo dar puntos si estuvo al menos 1 minuto
        if (minutesInVoice >= 1) {
          const puntosGanados = minutesInVoice * config.ajustes.puntosporVoz;
          
          // Inicializar datos del usuario si no existen
          if (!data.puntos[userId]) data.puntos[userId] = 0;
          if (!data.niveles[userId]) data.niveles[userId] = 0;
          
          // Dar puntos
          data.puntos[userId] += puntosGanados;
          saveData();
          
          console.log(`💰 ${username} ganó ${puntosGanados} puntos por ${minutesInVoice} minutos en voz`);
          
          // Verificar subida de nivel
          const oldLevel = data.niveles[userId];
          const newLevel = getLevel(data.puntos[userId]);
          
          if (newLevel > oldLevel) {
            data.niveles[userId] = newLevel;
            saveData();
            
            // Intentar encontrar un canal para notificar el nivel
            const guild = newState.guild;
            if (guild) {
              // Buscar un canal general para notificar
              const generalChannel = guild.channels.cache.find(ch => 
                ch.type === 0 && (ch.name.includes('general') || ch.name.includes('chat'))
              ) || guild.channels.cache.find(ch => ch.type === 0); // Cualquier canal de texto
              
              if (generalChannel) {
                const embed = new EmbedBuilder()
                  .setColor("#00FF00")
                  .setTitle("✨ ¡Nivel alcanzado por actividad de voz! ✨")
                  .setDescription(`🎉 <@${userId}> ha subido al **Nivel ${newLevel}** por su actividad en canales de voz!`)
                  .addFields(
                    { name: "⏰ Tiempo en voz", value: `${minutesInVoice} minutos`, inline: true },
                    { name: "💰 Puntos ganados", value: `${puntosGanados}`, inline: true }
                  )
                  .setTimestamp();
                
                try {
                  await generalChannel.send({ embeds: [embed] });
                  
                  // Verificar roles por nivel
                  const member = await guild.members.fetch(userId).catch(() => null);
                  if (member) {
                    for (let lvl in config.levelRoles) {
                      if (newLevel >= parseInt(lvl)) {
                        let roleId = config.levelRoles[lvl];
                        let role = guild.roles.cache.get(roleId);
                        if (role) {
                          // Remover roles de niveles anteriores
                          for (let oldRoleId of Object.values(config.levelRoles)) {
                            if (member.roles.cache.has(oldRoleId) && oldRoleId !== roleId) {
                              await member.roles.remove(oldRoleId).catch(() => {});
                            }
                          }
                          // Agregar nuevo rol
                          if (!member.roles.cache.has(roleId)) {
                            await member.roles.add(roleId).catch(() => {});
                            generalChannel.send(
                              `🔰 <@${userId}> ha conseguido el rol **${role.name}** por llegar al Nivel ${newLevel}!`
                            );
                          }
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.log(`❌ Error al enviar notificación de nivel: ${error.message}`);
                }
              }
            }
          }
        }
        
        // Limpiar seguimiento
        delete voiceTracking[userId];
      }
    }
    
    // Usuario CAMBIA de canal de voz (actualizar el tracking)
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      if (voiceTracking[userId]) {
        // Mantener el tiempo de inicio, solo actualizar el canal
        voiceTracking[userId].channelName = newState.channel.name;
        console.log(`🔄 ${username} se movió a: ${newState.channel.name}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error en sistema de voz: ${error.message}`);
  }
});

// Evento cuando el bot se conecta - mostrar usuarios ya en voz
client.on("ready", () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  console.log(`🌐 Servidor HTTP disponible en puerto ${PORT}`);
  console.log(`💰 Sistema de puntos: ${config.ajustes.puntosporMensaje} por mensaje, ${config.ajustes.puntosporVoz} por minuto de voz`);
  
  // Inicializar tracking para usuarios ya conectados a voz
  client.guilds.cache.forEach(guild => {
    guild.voiceStates.cache.forEach(voiceState => {
      if (voiceState.channel && !voiceState.member.user.bot) {
        const userId = voiceState.member.id;
        voiceTracking[userId] = {
          startTime: Date.now(),
          channelName: voiceState.channel.name
        };
        console.log(`🎤 Usuario ya en voz detectado: ${voiceState.member.user.username} en ${voiceState.channel.name}`);
      }
    });
  });
});

client.login(process.env.DISCORD_TOKEN);
