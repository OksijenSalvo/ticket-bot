const { 
    Client, GatewayIntentBits, Partials, ActivityType, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    ChannelType, PermissionsBitField, AttachmentBuilder, InteractionFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');



const CONFIG = {
    // GENEL AYARLAR
    TOKEN: '', 
    PREFIX: '!',
    SITE_URL: "https://www.blabla.com/",
    SUNUCU_ADI: "bla bla Hizmetleri",
    
    // GÖRSEL AYARLAR
    LOGO_DOSYA_ADI: "hostivon_logo.png", 
    THUMBNAIL_URL: "", // Sağ üstteki küçük resim URL'si (isteğe bağlı)
    
    // ID AYARLARI
    HOSGELDIN_KANAL_ID: '', 
    TICKET_KAPISI_KANAL_ID: '', 
    TICKET_KATEGORI_ID: '', 
    YETKILI_ROL_ID: '', 
    TRANSCRIPT_KANAL_ID: '', 
    
   
    TICKET_SECENEKLER: {
        "destek": { "label": "Destek", "emoji": "🔧", "description": "Teknik destek ve sunucu sorunları.", "yetkiliMesaji": `Destek Sorumlusu seninle ilgilenecek.` },
        "odeme": { "label": "Ödeme", "emoji": "💳", "description": "Ödeme, fatura ve iade işlemleri.", "yetkiliMesaji": `Fatura Sorumlusu seninle ilgilenecek.` },
        "genel": { "label": "Genel", "emoji": "💬", "description": "Genel soru ve önerileriniz.", "yetkiliMesaji": `Genel Sorumlu seninle ilgilenecek.` }
    }
};



const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});


let statusIndex = 0;

client.on('clientReady', () => { 
    console.log(`-------------------------------------------`);
    console.log(`Giriş Yapıldı: ${client.user.tag} (${client.user.id})`);
    console.log(`Prefix: ${CONFIG.PREFIX}`);
    console.log(`-------------------------------------------`);

 
    setInterval(() => {
        const statuses = [
            `Site: ${CONFIG.SITE_URL}`,
            `Sunucu: ${CONFIG.SUNUCU_ADI}`,
            `Komut: ${CONFIG.PREFIX}site`
        ];
        const status = statuses[statusIndex % statuses.length];
        client.user.setActivity(status, { type: ActivityType.Playing });
        statusIndex++;
    }, 10000); 

    client.on('interactionCreate', handleInteraction);
});


client.on('guildMemberAdd', (member) => {
    const kanal = member.guild.channels.cache.get(CONFIG.HOSGELDIN_KANAL_ID);
    if (kanal) {
        const hosgeldinMesaji = `🎉 Sunucumuza hoş geldin, ${member.toString()}! Aramıza katıldığın için mutluyuz. Üye sayımız: **${member.guild.memberCount}**`;
        kanal.send(hosgeldinMesaji).catch(console.error);
    }
});





const ticketAcmaButonu = new ButtonBuilder()
    .setCustomId('ac_ticket_button')
    .setLabel('Talep Oluştur')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📩');


const talebiDevralButonu = new ButtonBuilder()
    .setCustomId('devral_ticket_button')
    .setLabel('Talebi Devral')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🙋‍♂️'); 


const ticketKapatmaButonu = new ButtonBuilder()
    .setCustomId('kapat_ticket_button')
    .setLabel('Talebi Kapat')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌'); 



async function handleInteraction(interaction) {
    if (interaction.isButton()) {
        if (interaction.customId === 'ac_ticket_button') {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('destek_secenekleri')
                .setPlaceholder('Destek türünü seçin...');

            for (const key in CONFIG.TICKET_SECENEKLER) {
                const data = CONFIG.TICKET_SECENEKLER[key];
                selectMenu.addOptions({
                    label: data.label,
                    description: data.description,
                    emoji: data.emoji,
                    value: key
                });
            }

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                content: "Lütfen destek talebinizin türünü seçin:",
                components: [row],
                ephemeral: true 
            });
        } 
        
        else if (interaction.customId === 'kapat_ticket_button') {
            await handleTicketKapat(interaction);
        }
        else if (interaction.customId === 'devral_ticket_button') {
            const channel = interaction.channel;
            const user = interaction.user;
            const yetkiliRol = channel.guild.roles.cache.get(CONFIG.YETKILI_ROL_ID);

           
            if (!interaction.member || (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && !interaction.member.roles.cache.has(yetkiliRol.id))) {
                return interaction.reply({ content: "❌ Bu talebi devralmaya yetkiniz yok.", ephemeral: true });
            }

            
            await interaction.reply({ content: `✅ ${user.toString()} bu talebi devraldı!`, ephemeral: false });

           
            const updatedRow = new ActionRowBuilder()
                .addComponents(ticketKapatmaButonu); 

            await interaction.message.edit({ components: [updatedRow] });
        }

    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'destek_secenekleri') {     
            await interaction.deferUpdate();
            await handleTicketAc(interaction);
        }
    }
}


async function handleTicketAc(interaction) {

    const selectedValue = interaction.values[0];
    const user = interaction.user;
    const guild = interaction.guild;
    const yetkiliRol = guild.roles.cache.get(CONFIG.YETKILI_ROL_ID);
    const kategori = guild.channels.cache.get(CONFIG.TICKET_KATEGORI_ID);

    const safeUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    if (guild.channels.cache.some(c => c.name.startsWith(`ticket-${safeUsername}`))) {

        return interaction.editReply({ content: "❌ Zaten açık bir ticket'ınız bulunmakta.", ephemeral: true });
    }

    
    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
    ];
    if (yetkiliRol) {
        overwrites.push({ id: yetkiliRol.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] });
    }

    
    const channel = await guild.channels.create({
        name: `ticket-${safeUsername}`, 
        type: ChannelType.GuildText,
        parent: kategori ? kategori.id : null,
        permissionOverwrites: overwrites,
    });

    
    const secenekData = CONFIG.TICKET_SECENEKLER[selectedValue];
    let logoAttachment = null;
    let imageEmbedUrl = null;

    const logoPath = path.join(__dirname, CONFIG.LOGO_DOSYA_ADI);
    if (fs.existsSync(logoPath)) {
        logoAttachment = new AttachmentBuilder(logoPath, { name: CONFIG.LOGO_DOSYA_ADI });
        imageEmbedUrl = `attachment://${CONFIG.LOGO_DOSYA_ADI}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x36393F) 
        .setAuthor({ name: 'Talebinize Hoşgeldiniz', iconURL: client.user.displayAvatarURL() })
        .setDescription(`Talep **${secenekData.label}** kategorisinde başarıyla oluşturuldu.
Yetkililer aktif olduğunda size geri dönüş sağlayacaklardır. Lütfen istediğiniz dile getirin ve etiket atmadan yetkililerin talebe bakmasını bekleyin.`)
        .addFields(
            { name: 'Lütfen dikkat!', value: 'Lütfen taleplerde üslubunuza dikkat edin aksi takdirde yetkili ekibimiz talebi sonlandırma hakkı mevcuttur.' }
        );

    if (CONFIG.THUMBNAIL_URL) {
        embed.setThumbnail(CONFIG.THUMBNAIL_URL);
    }
    
    if (imageEmbedUrl) {
        embed.setImage(imageEmbedUrl);
    }


    const actionRow = new ActionRowBuilder()
        .addComponents(talebiDevralButonu, ticketKapatmaButonu); 

    await channel.send({
        content: `Merhaba ${user.toString()}, burada: <@&${CONFIG.YETKILI_ROL_ID}> ${secenekData.yetkiliMesaji}`,
        embeds: [embed],
        components: [actionRow],
        files: logoAttachment ? [logoAttachment] : [] 
    });
    
 
    await interaction.followUp({ 
        content: `✅ Ticket başarıyla açıldı: ${channel.toString()}`, 
        ephemeral: true 
    });
}



async function handleTicketKapat(interaction) {
    const channel = interaction.channel;
    const user = interaction.user;
    const guild = interaction.guild;
    const yetkiliRolId = CONFIG.YETKILI_ROL_ID;
    const transcriptChannelId = CONFIG.TRANSCRIPT_KANAL_ID;

    
    
    const safeUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    const isOwner = channel.name.endsWith(safeUsername) || channel.name.endsWith(user.id);
    
    let hasPermission = false;
    if (interaction.member) {
        const member = interaction.member;
        
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
        
        const hasStaffRole = member.roles && member.roles.cache ? member.roles.cache.has(yetkiliRolId) : false;
        
        hasPermission = isAdmin || hasStaffRole;
    }
    
    if (!hasPermission && !isOwner) {
        return interaction.reply({ content: "❌ Bu ticket'ı kapatma izniniz yok.", ephemeral: true });
    }

    await interaction.reply({ content: "✅ Ticket kapatılıyor ve kayıt alınıyor...", ephemeral: false });

    
    const messages = await channel.messages.fetch({ limit: 100 });
    let transcriptContent = `### Sunucu: ${guild.name}\n`;
    transcriptContent += `### Kapatan: ${user.tag} (${user.id})\n`;
    transcriptContent += `### Kapatılan Kanal: #${channel.name}\n`;
    transcriptContent += "------------------------------------------\n\n";

    messages.reverse().forEach(msg => {
        transcriptContent += `[${msg.createdAt.toLocaleTimeString('tr-TR')}] ${msg.author.tag}: ${msg.content}\n`;
    });

    
    const transcriptChannel = guild.channels.cache.get(transcriptChannelId);
    if (transcriptChannel) {
        const file = { attachment: Buffer.from(transcriptContent), name: `${channel.name}_kayit.md` };
        await transcriptChannel.send({ content: `🔒 **${channel.name}** kapatıldı. Kayıt:`, files: [file] });
    }

    
    setTimeout(async () => {
        await channel.delete().catch(console.error);
    }, 3000); 
}




client.on('messageCreate', async message => {
    
    if (message.author.bot || !message.content.startsWith(CONFIG.PREFIX)) return;
    
    const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ticket_kur') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ Bu komutu kullanmaya yetkiniz yok.");
        }
        if (message.channel.id !== CONFIG.TICKET_KAPISI_KANAL_ID) {
            return message.reply(`❌ Bu komut sadece belirlenen ticket kanalında (<#${CONFIG.TICKET_KAPISI_KANAL_ID}>) çalışır.`).then(m => setTimeout(() => m.delete(), 5000));
        }

      
        const mesajMetni = `Destek Talep Sistemi
Aşağıdaki **"Talep Oluştur"** butonuna tıklayarak destek talebinizi 
başlatabilirsiniz. Açılan menüde, talep nedeninizi seçtikten sonra 
sistem sizin için özel bir destek kanalı oluşturacaktır. Ekibimiz, 
oluşturduğunuz talep üzerinden en kısa sürede sizinle iletişime geçecektir.

Ek olarak, Destek açtığınız zaman ayrı yetkililere etiket atmanıza gerek yok, 
zaten aktif olarak talepler ile ilgilenmekteyiz. Etiket atarak sadece meşgul etmiş olursunuz.

Bilgilendirme: Teknik destek işlemleri yalnızca sistem üzerinden 
sağlanmaktadır. Discord üzerinden teknik destek verilmemektedir.`;

        let file = null;
        const logoPath = path.join(__dirname, CONFIG.LOGO_DOSYA_ADI);
        if (fs.existsSync(logoPath)) {
            file = { attachment: logoPath, name: CONFIG.LOGO_DOSYA_ADI };
        }

        const row = new ActionRowBuilder().addComponents(ticketAcmaButonu);

        await message.channel.send({ 
            content: mesajMetni, 
            files: file ? [file] : [],
            components: [row] 
        });
        
        await message.delete();
    }
    
    else if (command === 'site') {
        message.reply(`Sitemizin adresi: **${CONFIG.SITE_URL}**`);
    }
});



client.login(CONFIG.TOKEN).catch(err => {
    if (err.message.includes("An invalid token was provided")) {
        console.error("\n\n❌ HATA: Geçersiz Bot Tokenı. Lütfen CONFIG.TOKEN değerini kontrol edin.\n");
    } else {
        console.error(`\n\n❌ BOT ÇALIŞTIRILIRKEN HATA OLUŞTU: ${err.message}\n`);
    }
});