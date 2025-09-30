import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import fs from "fs";
import http from "http";

const PORT = process.env.PORT || 5000;

let data = { puntos: {}, niveles: {} };
let claims = { ultimosClaims: {} };
let vipTracking = { vipUsers: {} };
let client;

const server = http.createServer((req, res) => {
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
            <li><code>!claim</code> - Reclamar puntos diarios</li>
            <li><code>!top</code> - Ranking</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  } 
  else if (req.url === '/status') {
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

client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
});

let config = { 
  levelRoles: {},
  ajustes: {
    puntosporMensaje: 1,
    puntosporVoz: 1,
    multiplicadorExp: 1,
    prefijo: "!",
    canalAnuncios: null,
    rolAdmin: null,
    rolVIP: null,
    multiplicadorVIP: 2,
    puntosClaimDiario: 100,
    mensajeIP: "🌐 **Información del Servidor**\nIP: No configurada\nUsa `!admin configurar ip <texto>` para personalizar este mensaje."
  },
  comandosPersonalizados: {}
};

let sorteo = { activo: false, premio: "", costoPorParticipacion: 0, participantes: {} };

if (fs.existsSync("data.json")) {
  const loadedData = JSON.parse(fs.readFileSync("data.json"));
  data = { puntos: loadedData.puntos || {}, niveles: loadedData.niveles || {} };
}
if (fs.existsSync("claims.json")) {
  const loadedClaims = JSON.parse(fs.readFileSync("claims.json"));
  claims = { ultimosClaims: loadedClaims.ultimosClaims || {} };
}
if (fs.existsSync("vipTracking.json")) {
  const loadedVipTracking = JSON.parse(fs.readFileSync("vipTracking.json"));
  vipTracking = { vipUsers: loadedVipTracking.vipUsers || {} };
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
      rolVIP: loadedConfig.ajustes?.rolVIP || null,
      multiplicadorVIP: loadedConfig.ajustes?.multiplicadorVIP || 2,
      puntosClaimDiario: loadedConfig.ajustes?.puntosClaimDiario || 100,
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
function saveClaims() {
  fs.writeFileSync("claims.json", JSON.stringify(claims, null, 2));
}
function saveVipTracking() {
  fs.writeFileSync("vipTracking.json", JSON.stringify(vipTracking, null, 2));
}

function getLevel(puntos) {
  return Math.floor(Math.sqrt(puntos) / 2);
}

function isUserVIP(member) {
  if (!config.ajustes.rolVIP) return false;
  return member.roles.cache.has(config.ajustes.rolVIP);
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

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  let userId = msg.author.id;
  if (!data.puntos[userId]) data.puntos[userId] = 0;
  if (!data.niveles[userId]) data.niveles[userId] = 0;

  let puntosBase = config.ajustes.puntosporMensaje;
  
  const member = await msg.guild.members.fetch(userId).catch(() => null);
  if (member && isUserVIP(member)) {
    puntosBase = puntosBase * config.ajustes.multiplicadorVIP;
  }

  data.puntos[userId] += puntosBase;
  saveData();
  checkLevelUp(userId, msg);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const args = msg.content.split(" ");
  const cmd = args[0].toLowerCase();

  if (cmd === "!help" || cmd === "!ayuda" || cmd === "!comandos") {
    const vipInfo = config.ajustes.rolVIP 
      ? `\n• **Usuarios VIP** ganan **${config.ajustes.multiplicadorVIP}x** más puntos`
      : "";
    
    const embed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("📋 Comandos del Bot de Puntos y Sorteos")
      .setDescription("Lista completa de comandos disponibles")
      .addFields(
        { 
          name: "👤 **Comandos para Usuarios**", 
          value: `
          \`!puntos\` - Ver tus puntos y nivel
          \`!claim\` - Reclamar ${config.ajustes.puntosClaimDiario} puntos diarios (cada 24h)
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
          • Ganas **${config.ajustes.puntosporVoz} punto(s)** por minuto en voz${vipInfo}
          • Reclama **${config.ajustes.puntosClaimDiario} puntos** cada 24h con \`!claim\`
          • Los niveles se calculan automáticamente
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

  if (cmd === "!claim") {
    const userId = msg.author.id;
    const ahora = Date.now();
    const ultimoClaim = claims.ultimosClaims[userId] || 0;
    const tiempoTranscurrido = ahora - ultimoClaim;
    const COOLDOWN = 24 * 60 * 60 * 1000;

    if (tiempoTranscurrido < COOLDOWN) {
      const tiempoRestante = COOLDOWN - tiempoTranscurrido;
      const horasRestantes = Math.floor(tiempoRestante / (60 * 60 * 1000));
      const minutosRestantes = Math.floor((tiempoRestante % (60 * 60 * 1000)) / (60 * 1000));
      
      const embed = new EmbedBuilder()
        .setColor("#FF6B6B")
        .setTitle("⏰ Claim no disponible")
        .setDescription(`Ya has reclamado tus puntos diarios. Vuelve en:`)
        .addFields(
          { name: "⏱️ Tiempo restante", value: `${horasRestantes}h ${minutosRestantes}m`, inline: true }
        )
        .setFooter({ text: "¡Vuelve mañana para reclamar más puntos!" })
        .setTimestamp();
      
      msg.reply({ embeds: [embed] });
      return;
    }

    if (!data.puntos[userId]) data.puntos[userId] = 0;
    if (!data.niveles[userId]) data.niveles[userId] = 0;

    const member = await msg.guild.members.fetch(userId).catch(() => null);
    const esVIP = member && isUserVIP(member);
    
    let puntosReclamados = config.ajustes.puntosClaimDiario;
    if (esVIP) {
      puntosReclamados = Math.floor(puntosReclamados * config.ajustes.multiplicadorVIP);
    }
    
    data.puntos[userId] += puntosReclamados;
    claims.ultimosClaims[userId] = ahora;
    
    saveData();
    saveClaims();
    await checkLevelUp(userId, msg);

    const embedFields = [
      { name: "💰 Puntos reclamados", value: `${puntosReclamados}`, inline: true },
      { name: "📊 Total puntos", value: `${data.puntos[userId]}`, inline: true },
      { name: "⏰ Próximo claim", value: "24 horas", inline: true }
    ];

    if (esVIP) {
      embedFields.push({ 
        name: "👑 Bonus VIP", 
        value: `¡Recibiste ${config.ajustes.multiplicadorVIP}x más puntos!`, 
        inline: false 
      });
    }

    const embed = new EmbedBuilder()
      .setColor(esVIP ? "#FFD700" : "#00FF00")
      .setTitle(esVIP ? "🎁 ¡Claim VIP Exitoso! 👑" : "🎁 ¡Claim Exitoso!")
      .setDescription(`¡Has reclamado tus puntos diarios!`)
      .addFields(embedFields)
      .setFooter({ text: "¡Vuelve mañana para reclamar más puntos!" })
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
    
    const member = await msg.guild.members.fetch(userId).catch(() => null);
    const esVIP = member && isUserVIP(member);
    const vipText = esVIP ? " 👑 **(VIP)**" : "";
    
    msg.reply(`Tienes **${score} puntos** y eres **Nivel ${level}**${vipText}.`);
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
      
      const member = await msg.guild.members.fetch(userId).catch(() => null);
      const vipIcon = (member && isUserVIP(member)) ? " 👑" : "";
      
      ranking += `${icon} ${user ? user.username : "Usuario desconocido"}${vipIcon} — **${score} puntos** | 🎯 Nivel ${level}\n`;
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

    const member = await msg.guild.members.fetch(userId).catch(() => null);
    const esVIP = member && isUserVIP(member);
    const vipField = esVIP ? { name: "👑 Estado VIP", value: "Usuario VIP", inline: true } : null;

    const embedFields = [
      { name: "⭐ Puntos", value: `${score}`, inline: true },
      { name: "🎯 Nivel", value: `${level}`, inline: true },
      { name: "🔰 Rol actual", value: roleName, inline: true }
    ];

    if (vipField) embedFields.push(vipField);

    const embed = new EmbedBuilder()
      .setColor("#1ABC9C")
      .setTitle(`👤 Perfil de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(embedFields)
      .setFooter({ text: `Servidor: ${msg.guild.name}`, iconURL: msg.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    msg.reply({ embeds: [embed] });
  }

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
        msg.reply("❓ Ajustes disponibles:\n• `puntos_mensaje` - Puntos por mensaje\n• `puntos_voz` - Puntos por minuto en voz\n• `multiplicador` - Multiplicador de EXP\n• `prefijo` - Prefijo de comandos\n• `rol_vip` - Configurar rol VIP (@rol)\n• `multiplicador_vip` - Multiplicador para usuarios VIP\n• `claim_diario` - Puntos por claim diario\n• `ip` - Mensaje personalizado\n\nUso: `!admin configurar <ajuste> <valor>`");
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

      else if (ajuste === "puntos_voz") {
        const nuevoValor = parseInt(valor);
        if (isNaN(nuevoValor) || nuevoValor < 0) {
          msg.reply("⚠️ El valor debe ser un número mayor o igual a 0.");
          return;
        }
        config.ajustes.puntosporVoz = nuevoValor;
        saveConfig();
        msg.reply(`✅ Puntos por minuto de voz configurados a: **${nuevoValor}**`);
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

      else if (ajuste === "rol_vip") {
        const role = msg.mentions.roles.first();
        if (!role) {
          msg.reply("⚠️ Debes mencionar un rol válido. Uso: `!admin configurar rol_vip @rol`");
          return;
        }
        config.ajustes.rolVIP = role.id;
        saveConfig();
        
        const embed = new EmbedBuilder()
          .setColor("#FFD700")
          .setTitle("👑 Rol VIP Configurado")
          .setDescription(`El rol **${role.name}** ahora es VIP`)
          .addFields(
            { name: "💎 Beneficios", value: `Los usuarios con este rol ganan **${config.ajustes.multiplicadorVIP}x** más puntos`, inline: false }
          )
          .setTimestamp();
        
        msg.reply({ embeds: [embed] });
      }

      else if (ajuste === "multiplicador_vip") {
        const nuevoValor = parseFloat(valor);
        if (isNaN(nuevoValor) || nuevoValor <= 0) {
          msg.reply("⚠️ El multiplicador VIP debe ser un número mayor a 0.");
          return;
        }
        config.ajustes.multiplicadorVIP = nuevoValor;
        saveConfig();
        msg.reply(`✅ Multiplicador VIP configurado a: **${nuevoValor}x**`);
      }

      else if (ajuste === "claim_diario") {
        const nuevoValor = parseInt(valor);
        if (isNaN(nuevoValor) || nuevoValor < 1) {
          msg.reply("⚠️ El valor debe ser un número mayor a 0.");
          return;
        }
        config.ajustes.puntosClaimDiario = nuevoValor;
        saveConfig();
        msg.reply(`✅ Puntos por claim diario configurados a: **${nuevoValor}**`);
      }

      else if (ajuste === "ip") {
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
        msg.reply("❌ Ajuste no válido. Usa `!admin configurar` sin parámetros para ver la lista completa.");
      }
    }

    else if (subcommand === "ver_config") {
      const rolVIPNombre = config.ajustes.rolVIP 
        ? (msg.guild.roles.cache.get(config.ajustes.rolVIP)?.name || "Rol eliminado")
        : "No configurado";

      const embed = new EmbedBuilder()
        .setColor("#4ECDC4")
        .setTitle("⚙️ Configuración Actual del Bot")
        .addFields(
          { name: "💬 Puntos por mensaje", value: `${config.ajustes.puntosporMensaje}`, inline: true },
          { name: "🎤 Puntos por minuto voz", value: `${config.ajustes.puntosporVoz}`, inline: true },
          { name: "🔢 Multiplicador EXP", value: `${config.ajustes.multiplicadorExp}x`, inline: true },
          { name: "👑 Rol VIP", value: rolVIPNombre, inline: true },
          { name: "💎 Multiplicador VIP", value: `${config.ajustes.multiplicadorVIP}x`, inline: true },
          { name: "🎁 Claim diario", value: `${config.ajustes.puntosClaimDiario} puntos`, inline: true },
          { name: "🎯 Prefijo", value: `${config.ajustes.prefijo}`, inline: true },
          { name: "📊 Total usuarios", value: `${Object.keys(data.puntos).length}`, inline: true },
          { name: "🏆 Roles configurados", value: `${Object.keys(config.levelRoles).length}`, inline: true }
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

        const comandosSistema = ['puntos', 'top', 'perfil', 'setrol', 'verroles', 'admin', 'sorteo', 'help', 'ayuda', 'comandos', 'ip', 'clear', 'claim'];
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
          usos: config.comandosPersonalizados[nombreComando]?.usos || 0
        };
        saveConfig();

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(`✅ Comando ${esNuevo ? 'Creado' : 'Editado'}`)
          .setDescription(`Comando personalizado **!${nombreComando}** ${esNuevo ? 'creado' : 'editado'} exitosamente`)
          .addFields(
            { name: "📝 Comando", value: `!${nombreComando}`, inline: true },
            { name: "👤 Creador", value: msg.author.username, inline: true },
            { name: "💬 Respuesta", value: textoRespuesta.substring(0, 100) + (textoRespuesta.length > 100 ? "..." : ""), inline: false }
          )
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

        msg.reply(`🗑️ Comando **!${nombreComando}** eliminado exitosamente.`);
      }

      else if (accion === "lista") {
        const comandos = Object.keys(config.comandosPersonalizados);
        
        if (comandos.length === 0) {
          msg.reply("📋 No hay comandos personalizados creados aún.");
          return;
        }

        let listaComandos = "";
        for (const cmd of comandos) {
          const info = config.comandosPersonalizados[cmd];
          listaComandos += `• **!${cmd}** - Creado por ${info.creador} | Usos: ${info.usos}\n`;
        }

        const embed = new EmbedBuilder()
          .setColor("#9B59B6")
          .setTitle("📋 Comandos Personalizados")
          .setDescription(listaComandos || "No hay comandos personalizados.")
          .setFooter({ text: `Total: ${comandos.length} comandos` })
          .setTimestamp();

        msg.reply({ embeds: [embed] });
      }

      else {
        msg.reply("❌ Acción no válida. Usa: `crear`, `editar`, `eliminar` o `lista`");
      }
    }

    else {
      msg.reply("❓ Subcomando no válido. Usa `!admin` para ver comandos disponibles.");
    }
  }

  if (cmd === "!clear") {
    if (!msg.member.permissions.has("ManageMessages")) {
      msg.reply("🚫 No tienes permisos para borrar mensajes.");
      return;
    }

    let cantidad = parseInt(args[1]) || 10;
    if (cantidad < 1) cantidad = 1;
    if (cantidad > 100) cantidad = 100;

    try {
      const mensajesBorrados = await msg.channel.bulkDelete(cantidad + 1, true);
      const respuesta = await msg.channel.send(`🗑️ Se han borrado **${mensajesBorrados.size - 1}** mensajes.`);
      
      setTimeout(() => {
        respuesta.delete().catch(() => {});
      }, 5000);
    } catch (error) {
      msg.reply("❌ Error al borrar mensajes. Es posible que los mensajes sean muy antiguos (más de 14 días).");
    }
  }

  if (cmd === "!sorteo") {
    if (args.length < 2) {
      msg.reply("❓ Comandos disponibles: `crear`, `participar`, `ver`, `mis_participaciones`, `finalizar`");
      return;
    }

    const subcommand = args[1].toLowerCase();

    if (subcommand === "crear") {
      if (!msg.member.permissions.has("Administrator")) {
        msg.reply("🚫 Solo los administradores pueden crear sorteos.");
        return;
      }

      if (sorteo.activo) {
        msg.reply("❌ Ya hay un sorteo activo. Usa `!sorteo finalizar` para terminarlo antes de crear uno nuevo.");
        return;
      }

      if (args.length < 4) {
        msg.reply("❓ Uso: `!sorteo crear <costo_por_participacion> <premio...>`");
        return;
      }

      const costo = parseInt(args[2]);
      if (isNaN(costo) || costo < 1) {
        msg.reply("⚠️ El costo debe ser un número mayor a 0.");
        return;
      }

      const premio = args.slice(3).join(" ");
      if (premio.length < 1) {
        msg.reply("⚠️ Debes especificar un premio.");
        return;
      }

      sorteo = {
        activo: true,
        premio: premio,
        costoPorParticipacion: costo,
        participantes: {}
      };
      saveSorteo();

      const embed = new EmbedBuilder()
        .setColor("#9B59B6")
        .setTitle("🎲 ¡Nuevo Sorteo Creado!")
        .setDescription(`🎁 **Premio:** ${premio}`)
        .addFields(
          { name: "💰 Costo por participación", value: `${costo} puntos`, inline: true },
          { name: "📝 Cómo participar", value: `\`!sorteo participar <puntos>\``, inline: false }
        )
        .setFooter({ text: "¡Buena suerte a todos!" })
        .setTimestamp();

      msg.reply({ embeds: [embed] });
    }

    else if (subcommand === "participar") {
      if (!sorteo.activo) {
        msg.reply("❌ No hay ningún sorteo activo actualmente.");
        return;
      }

      if (args.length < 3) {
        msg.reply(`❓ Uso: \`!sorteo participar <puntos>\`\nCosto: **${sorteo.costoPorParticipacion}** puntos por participación`);
        return;
      }

      const puntosAGastar = parseInt(args[2]);
      if (isNaN(puntosAGastar) || puntosAGastar < sorteo.costoPorParticipacion) {
        msg.reply(`⚠️ Debes gastar al menos **${sorteo.costoPorParticipacion} puntos**.`);
        return;
      }

      const userId = msg.author.id;
      const puntosActuales = data.puntos[userId] || 0;

      if (puntosActuales < puntosAGastar) {
        msg.reply(`❌ No tienes suficientes puntos. Tienes **${puntosActuales}** pero intentas gastar **${puntosAGastar}**.`);
        return;
      }

      const participacionesCompradas = Math.floor(puntosAGastar / sorteo.costoPorParticipacion);
      const puntosRealesGastados = participacionesCompradas * sorteo.costoPorParticipacion;

      data.puntos[userId] -= puntosRealesGastados;
      data.niveles[userId] = getLevel(data.puntos[userId]);
      saveData();

      if (!sorteo.participantes[userId]) {
        sorteo.participantes[userId] = 0;
      }
      sorteo.participantes[userId] += participacionesCompradas;
      saveSorteo();

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("🎫 Participación Exitosa")
        .setDescription(`Has participado en el sorteo de: **${sorteo.premio}**`)
        .addFields(
          { name: "🎫 Participaciones compradas", value: `${participacionesCompradas}`, inline: true },
          { name: "💰 Puntos gastados", value: `${puntosRealesGastados}`, inline: true },
          { name: "📊 Puntos restantes", value: `${data.puntos[userId]}`, inline: true },
          { name: "🎲 Tus participaciones totales", value: `${sorteo.participantes[userId]}`, inline: false }
        )
        .setFooter({ text: "¡Buena suerte!" })
        .setTimestamp();

      msg.reply({ embeds: [embed] });
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

      let participaciones = [];
      for (let userId in sorteo.participantes) {
        const cantidadParticipaciones = sorteo.participantes[userId];
        for (let i = 0; i < cantidadParticipaciones; i++) {
          participaciones.push(userId);
        }
      }

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

      sorteo = { activo: false, premio: "", costoPorParticipacion: 0, participantes: {} };
      saveSorteo();
    }

    else {
      msg.reply("❓ Comandos disponibles: `crear`, `participar`, `ver`, `mis_participaciones`, `finalizar`");
    }
  }

  const nombreCmd = cmd.slice(1);
  if (config.comandosPersonalizados[nombreCmd]) {
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

let voiceTracking = {};

client.on("voiceStateUpdate", async (oldState, newState) => {
  const userId = newState.member.id;
  const username = newState.member.user.username;
  
  try {
    if (!oldState.channel && newState.channel) {
      voiceTracking[userId] = {
        startTime: Date.now(),
        channelName: newState.channel.name
      };
      console.log(`🎤 ${username} entró al canal de voz: ${newState.channel.name}`);
    }
    
    else if (oldState.channel && !newState.channel) {
      if (voiceTracking[userId]) {
        const timeInVoice = Date.now() - voiceTracking[userId].startTime;
        const minutesInVoice = Math.floor(timeInVoice / 60000);
        
        console.log(`🎤 ${username} salió del canal de voz: ${oldState.channel.name} (${minutesInVoice} minutos)`);
        
        if (minutesInVoice >= 1) {
          let puntosBase = minutesInVoice * config.ajustes.puntosporVoz;
          
          const member = newState.member;
          if (isUserVIP(member)) {
            puntosBase = puntosBase * config.ajustes.multiplicadorVIP;
          }
          
          if (!data.puntos[userId]) data.puntos[userId] = 0;
          if (!data.niveles[userId]) data.niveles[userId] = 0;
          
          data.puntos[userId] += puntosBase;
          saveData();
          
          console.log(`💰 ${username} ganó ${puntosBase} puntos por ${minutesInVoice} minutos en voz`);
          
          const oldLevel = data.niveles[userId];
          const newLevel = getLevel(data.puntos[userId]);
          
          if (newLevel > oldLevel) {
            data.niveles[userId] = newLevel;
            saveData();
            
            const guild = newState.guild;
            if (guild) {
              const generalChannel = guild.channels.cache.find(ch => 
                ch.type === 0 && (ch.name.includes('general') || ch.name.includes('chat'))
              ) || guild.channels.cache.find(ch => ch.type === 0);
              
              if (generalChannel) {
                const embed = new EmbedBuilder()
                  .setColor("#00FF00")
                  .setTitle("✨ ¡Nivel alcanzado por actividad de voz! ✨")
                  .setDescription(`🎉 <@${userId}> ha subido al **Nivel ${newLevel}** por su actividad en canales de voz!`)
                  .addFields(
                    { name: "⏰ Tiempo en voz", value: `${minutesInVoice} minutos`, inline: true },
                    { name: "💰 Puntos ganados", value: `${puntosBase}`, inline: true }
                  )
                  .setTimestamp();
                
                try {
                  await generalChannel.send({ embeds: [embed] });
                  
                  const member = await guild.members.fetch(userId).catch(() => null);
                  if (member) {
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
        
        delete voiceTracking[userId];
      }
    }
    
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      if (voiceTracking[userId]) {
        voiceTracking[userId].channelName = newState.channel.name;
        console.log(`🔄 ${username} se movió a: ${newState.channel.name}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error en sistema de voz: ${error.message}`);
  }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!config.ajustes.rolVIP) return;
  
  const hadVIP = oldMember.roles.cache.has(config.ajustes.rolVIP);
  const hasVIP = newMember.roles.cache.has(config.ajustes.rolVIP);
  
  if (!hadVIP && hasVIP) {
    const userId = newMember.id;
    const ahora = Date.now();
    
    if (!data.puntos[userId]) data.puntos[userId] = 0;
    if (!data.niveles[userId]) data.niveles[userId] = 0;
    
    data.puntos[userId] += 2000;
    vipTracking.vipUsers[userId] = ahora;
    
    saveData();
    saveVipTracking();
    
    console.log(`👑 VIP otorgado a ${newMember.user.username} (+2000 puntos)`);
    
    try {
      const guild = newMember.guild;
      const generalChannel = guild.channels.cache.find(ch => 
        ch.type === 0 && (ch.name.includes('general') || ch.name.includes('chat'))
      ) || guild.channels.cache.find(ch => ch.type === 0);
      
      if (generalChannel) {
        const embed = new EmbedBuilder()
          .setColor("#FFD700")
          .setTitle("👑 ¡Nuevo VIP!")
          .setDescription(`¡<@${userId}> ahora es VIP!`)
          .addFields(
            { name: "🎁 Bonus de bienvenida", value: "2000 puntos", inline: true },
            { name: "💎 Beneficios VIP", value: `${config.ajustes.multiplicadorVIP}x más puntos`, inline: true },
            { name: "⏰ Duración", value: "30 días", inline: true }
          )
          .setTimestamp();
        
        await generalChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.log(`❌ Error al notificar VIP: ${error.message}`);
    }
  }
});

async function checkExpiredVIPs() {
  if (!config.ajustes.rolVIP) return;
  
  const ahora = Date.now();
  const unMes = 30 * 24 * 60 * 60 * 1000;
  
  for (const userId in vipTracking.vipUsers) {
    const fechaVIP = vipTracking.vipUsers[userId];
    const tiempoTranscurrido = ahora - fechaVIP;
    
    if (tiempoTranscurrido >= unMes) {
      try {
        for (const guild of client.guilds.cache.values()) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member && member.roles.cache.has(config.ajustes.rolVIP)) {
            await member.roles.remove(config.ajustes.rolVIP);
            
            delete vipTracking.vipUsers[userId];
            saveVipTracking();
            
            console.log(`👑 VIP expirado removido de ${member.user.username}`);
            
            const generalChannel = guild.channels.cache.find(ch => 
              ch.type === 0 && (ch.name.includes('general') || ch.name.includes('chat'))
            ) || guild.channels.cache.find(ch => ch.type === 0);
            
            if (generalChannel) {
              const embed = new EmbedBuilder()
                .setColor("#FF6B6B")
                .setTitle("👑 VIP Expirado")
                .setDescription(`El VIP de <@${userId}> ha expirado después de 30 días.`)
                .setTimestamp();
              
              await generalChannel.send({ embeds: [embed] });
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error al remover VIP expirado: ${error.message}`);
      }
    }
  }
}

client.on("ready", () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  console.log(`🌐 Servidor HTTP disponible en puerto ${PORT}`);
  console.log(`💰 Sistema de puntos: ${config.ajustes.puntosporMensaje} por mensaje, ${config.ajustes.puntosporVoz} por minuto de voz`);
  console.log(`👑 Rol VIP configurado: ${config.ajustes.rolVIP ? 'Sí' : 'No'} (Multiplicador: ${config.ajustes.multiplicadorVIP}x)`);
  console.log(`🎁 Claim diario: ${config.ajustes.puntosClaimDiario} puntos cada 24h`);
  
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
  
  setInterval(checkExpiredVIPs, 60 * 60 * 1000);
  console.log(`⏰ Sistema de expiración VIP iniciado (revisa cada hora)`);
});

client.login(process.env.DISCORD_TOKEN);
