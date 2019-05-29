let ws
let TMI
let timeout
let username
let channel
let command
let win
let start
let current
let bot
let GoAgain


function sendMessage(message) {
    ws.send("PRIVMSG #" + channel + " :" + message + "\r\n")
}

function LetsGoAgain() {
    sendMessage(command + ' ' + current)
}

function StartTTV(TMI, username, channel, timeout){
    if (window.location.protocol === 'https:'){
        ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
    } else {
        ws = new WebSocket('ws://irc-ws.chat.twitch.tv:80')
    }

    ws.onopen = (message) => {
        console.log('Connecting...')
        ws.send("PASS " + TMI + "\r\n")
        ws.send("NICK " + username + "\r\n")
        ws.send("JOIN #" + channel + "\r\n")
    }

    ws.onmessage = (message) => {
        if(message.data.includes(':End of /NAMES list')){
            if (! message.data.includes('PRIVMSG')){
                console.log('Connected!')
                sendMessage(command + ' ' + current)
                GoAgain = setTimeout(LetsGoAgain, timeout*0.8)
            }
            return
        }
        let msg = message.data
        if (bot.test(msg) === false){
            return
        }
        clearInterval(GoAgain)
        if (win.test(msg)){
            console.log('won')
            if (current == start){
                current = new String(parseInt(current)+1).valueOf()
            } else {
                current = new String(start).valueOf()
            }
            setTimeout(()=>{
                sendMessage(command + ' ' + current)
                GoAgain = setInterval(LetsGoAgain, timeout)
            }, timeout)
            return
        }
        console.log('lost')
        current = new String(parseInt(current)*2).valueOf()
        setTimeout(()=>{
            sendMessage(command + ' ' + current)
            GoAgain = setInterval(LetsGoAgain, timeout)
        }, timeout)
    }
    
    ws.onclose = (message) => {
        console.log(message)
    }
    
    ws.onerror = (message) => {
        console.log(message)
    }
}

document.getElementById('go').addEventListener('click', () => {
    for (let i of document.querySelectorAll('input')){
        if (i.value === ''){
            console.log('Please fill all inputs...')
            return
        }
    }
    TMI = document.getElementById('TMI').value
    timeout = parseInt(document.getElementById('timeout').value)
    username = document.getElementById('username').value
    channel = document.getElementById('channel').value
    command = document.getElementById('command').value
    start = parseInt(document.getElementById('start').value)
    win = document.getElementById('win').value
    bot = document.getElementById('bot').value.toLowerCase()
    bot = new RegExp('^:' + bot + '!' + bot + '@' + bot + '\.tmi\.twitch\.tv')
    if (isNaN(timeout) || isNaN(start)){
        console.log('"timeout" and "start gamble" have to be an int :)')
        return
    }
    if (timeout < 1 || start < 1){
        console.log('"timeout" and "start gamble" have to be 1 or larger :)')
        return
    }
    if (TMI.substr(0,6) !== 'oauth:'){
        console.log('Invalid TMI')
        return
    }
    win = new RegExp(document.getElementById('win').value)
    current = new String(start).valueOf()
    StartTTV(TMI, username, channel, timeout)
})
