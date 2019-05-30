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
let LowerLimit
let IdentifyMessage
let balance = 0
let scores = {'wins':0, 'losses':0}

let LatestMessage
let NewMessage = false

function sendMessage(message) {
    ws.send("PRIVMSG #" + channel + " :" + message + "\r\n")
}

function StartGamble() {
    if (NewMessage === true){
        NewMessage = false
        if (win.test(LatestMessage) === true){
            if (current === start){
                current = start+1
            } else {
                current = start
            }
            sendMessage(command + ' ' + current)
            return
        }
        current = current * 2
        sendMessage(command + ' ' + current)
        return
    }
    sendMessage(command + ' ' + current)
    return
}

function StartTTV(TMI, username, channel){
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
            }
            return
        }
        let msg = message.data
        if (bot.test(msg) === false){
            return
        }
        if (IdentifyMessage.test(msg) === false){
            return
        }
        if (win.test(msg)){
            scores.wins++
        } else {
            scores.losses++
        }
        document.getElementById('winrate').innerHTML = ((scores.wins/(scores.wins+scores.losses))*100).toFixed(2) + '%'

        if (win.test(msg)){
            balance += current
        } else {
            balance -= current
        }

        document.getElementById('balance').innerHTML = new String(balance).valueOf()

        NewMessage = true
        LatestMessage = msg
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
    LowerLimit = parseInt(document.getElementById('LowerLimit').value)

    win = document.getElementById('win').value
    bot = document.getElementById('bot').value.toLowerCase()
    if (isNaN(timeout) || isNaN(start) || isNaN(LowerLimit)){
        console.log('"timeout", "start gamble" and "Lower limit" have to be ints :)')
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
    bot = new RegExp('^:' + bot + '!' + bot + '@' + bot + '\.tmi\.twitch\.tv')
    IdentifyMessage = RegExp(document.getElementById('IdentifyMessage').value)
    win = new RegExp(document.getElementById('win').value)
    current = start
    StartTTV(TMI, username, channel)
    setInterval(StartGamble , timeout)
})
