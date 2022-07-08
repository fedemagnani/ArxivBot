var messaggio = "Bella rega"
const fs = require("fs");
const { Client, Intents, MessageEmbed } = require('discord.js');
const token = "OTg0Mzk3NjAwMTcyMTU4OTk2.GrRWff.CTffd4VOCEJSjqCFnxMFJZuZMOi_g7_ZGl8i48"//fs.readFileSync(".secretToken").toString().trim() //Private!
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
var channel;
var channelName = "discussione-generale";
function setUpCerebrus(){
    return new Promise(async(resolve)=>{
        await bot.login(token);
        bot.on('ready', async function () {
            channel = bot.channels.cache.find(chan => chan.name === channelName)
            resolve(channel)
        })
    })
}
setUpCerebrus().then(async()=>{await channel.send(messaggio)})