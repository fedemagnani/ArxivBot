/*
prefix	explanation
ti	Title
au	Author
abs	Abstract
co	Comment
jr	Journal Reference
cat	Subject Category
rn	Report Number
id	Id (use id_list instead)
all	All of the above

AND
OR
ANDNOT
*/

var request = require('request');
const { exec } = require('child_process');
var DOMParser = new (require('xmldom')).DOMParser;
const fs = require('fs');
const path = require('path');
const { Client, Intents, MessageEmbed } = require('discord.js');
const token = "" //Private! Paste here the token of your bot (→ discord developer portal)
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
var channel;
var channelName = "🤖📃cerebrus-papers"
var queryWords = require('./queryWords.json')
var papersSent = require('./papersSent.json');
var totalPapers = typeof require('./totalPapers.json')=="string"?JSON.parse(require('./totalPapers.json')):require('./totalPapers.json');
var maximumLength = 400;
var delay = 60000; //1 min of delay for discord messages
var delayCall = 14400000//300000; //4 h

function waitFor(ms){
    return new Promise((resolve)=>{
        setTimeout(()=>{resolve()},ms)
    })
}

function arXivQuery(){
    var stringifiedQuery = queryWords.map((x)=>{
        return x.split(" ").length>1?`all:"${x}"`:`all:${x}`
    }).join("+OR+")
    var cacheBuster = `&ciao=${Math.round(Math.random()*10000000)}`
    return new Promise((resolve, reject) =>{
        var options = {
            'method': 'GET',
            'url': `http://export.arxiv.org/api/query?search_query=${stringifiedQuery}&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending${cacheBuster}`,
            'headers': {
            }
        };
        console.log(options.url)
        request(options, function (error, response) {
            // if (error) throw new Error(error);
            try{
                console.log(response.statusCode)
                var document = DOMParser.parseFromString(response.body);
                resolve(document);  
            }catch(e){
                console.log(e)
                reject(e)
            }
        });
    })
}

async function getArXivPapers(){
    var document = await arXivQuery();
    var nodesByName = document.getElementsByTagName('entry');
    var paperz = []
    for(var j=0;j<nodesByName.length;j++){
        var elems = nodesByName[j].childNodes
        var w={}
        var authors=[]
        for(var i=0;i<elems.length;i++){
            if(!elems[i].nextSibling){
                continue;
            }
            if(["id","published","title","summary","arxiv:comment"].includes(elems[i].nextSibling.nodeName)&&elems[i].nextSibling.firstChild){
                w[elems[i].nextSibling.nodeName.replace("arxiv:","")]=JSON.stringify(elems[i].nextSibling.firstChild.data).replace(/\\n|\r/gi," ").replace(/"/gi,"");
            }
            if("author".includes(elems[i].nextSibling.nodeName)){
                for(var z=0;z<elems[i].nextSibling.childNodes.length;z++){
                    if(elems[i].nextSibling.childNodes[z].nextSibling&&elems[i].nextSibling.childNodes[z].nextSibling.firstChild){
                        authors.push(elems[i].nextSibling.childNodes[z].nextSibling.firstChild.data);
                    }
                }
            }
        }
        w["authors"]=authors.join(", ")
        w["pdf"] = w["id"].replace("abs","pdf")
        w["imageURL"]="https://avatars.githubusercontent.com/u/45442578?s=280&v=4"
        w["published"]=new Date(w["published"]).toUTCString()
        paperz.push(w)
    }
    return paperz
}

function setUpCerebrus(){
    return new Promise(async(resolve)=>{
        await bot.login(token);
        bot.on('ready', async function () {
            channel = bot.channels.cache.find(chan => chan.name === channelName)
            // channel.send("Back online!")
            resolve(channel)
        })
    })
}

function createEmbedFromPaper(paper){
    console.log(paper)
    var embed = new MessageEmbed()
    .setTitle(paper.title)
    .setColor('#8f00ff')
    .setThumbnail(paper.imageURL)
    .setFooter({text:"Created with <3 by Drun"})
    for(var i=0;i<Object.keys(paper).length;i++){
        if(["title","id","imageURL"].includes(Object.keys(paper)[i])){
            continue
        }
        embed=embed.addFields(
            // { name: Object.keys(paper)[i], value: Object.values(paper)[i].length>0?Object.values(paper)[i].length>1000?Object.values(paper)[i].slice(0,1000)+"...":Object.values(paper)[i]:"NaN", inline: false },
            { name: Object.keys(paper)[i], value: Object.values(paper)[i].length>0?Object.values(paper)[i].slice(0,maximumLength)+"...":"NaN", inline: false },
        
        )

    }
    return embed
}

function atLeastOnePresent(string, arrayWords) {
    let found = false
    for (var z = 0; z < arrayWords.length; z++) {
        if (string.includes(arrayWords[z])) {
            found = true
        }
    }
    return found
}

async function talkWithMe(message){
    if(message.author.bot){
        return
    }
    if(atLeastOnePresent(message.content,["/list","/parole","/words"])){
        await channel.send(queryWords.join("\n"))
    }
    if(atLeastOnePresent(message.content,["/left","/rimasti","/ancora"])){
        await channel.send(String(totalPapers.length-papersSent.length))
    }
    if(atLeastOnePresent(message.content,["/edit","/modifica","/nuovo"])){
        var newKeyWords = message.content.split(",").map(x=>x.trim())
        newKeyWords[0]=newKeyWords[0].split(" ").pop()
        queryWords = queryWords.concat(newKeyWords)
        await updateEverything()
        await channel.send("ok")
    }
    if(atLeastOnePresent(message.content,["/time","/tempo","/delay"])){
        var splitting = message.content.split(" ").map(x=>x.trim())
        if(splitting.length==1){
            channel.send(`${delay} ms`)
        }else{
            var val = splitting.pop()
            delay = Number(val)>0?val:delay
            await channel.send(`I put delay at ${delay} ms`)
        }
    }
}

async function periodicPaperCall(){
    return new Promise(async (resolve) =>{
        try{
            var paperz = await getArXivPapers()
            for(i=0;i<paperz.length;i++){
                if(totalPapers.findIndex(obj=>obj.id===paperz[i].id)<0){
                    totalPapers.push(paperz[i])
                }
            }
            for(i=0;i<totalPapers.length;i++){
                if(papersSent.indexOf(totalPapers[i].id)<0){
                    var embed = createEmbedFromPaper(totalPapers[i]);
                    await channel.send({embeds:[embed]})
                    await waitFor(delay)
                    papersSent.push(totalPapers[i].id);
                    await updateEverything()
                    exec('git commit -a -m "autocommit"');
                    exec('git push');
                }
            }
            await waitFor(delayCall)
            resolve()
        }catch(e){
            console.log(e);
            resolve()
        }
    }).then(()=>{periodicPaperCall()})
}

function updateEverything(){
    return new Promise((resolve)=>{
        fs.writeFileSync(path.join(__dirname,"queryWords.json"),JSON.stringify(queryWords));
        fs.writeFileSync(path.join(__dirname,"papersSent.json"),JSON.stringify(papersSent));
        fs.writeFileSync(path.join(__dirname,"totalPapers.json"),JSON.stringify(totalPapers));
        resolve()
    })
}

setUpCerebrus().then(()=>{periodicPaperCall()})
    // await channel.send({embeds:[embed]})
bot.on("message", async(message) => {
    await talkWithMe(message)
})

// ;(async()=>{
//     // var paperz = await getArXivPapers()
//     // var embed = createEmbedFromPaper(paperz[0])
//     setUpCerebrus().then(()=>{periodicPaperCall()})
//     // await channel.send({embeds:[embed]})
//     bot.on("message", async(message) => {
//         await talkWithMe(message)
//     })
// })();