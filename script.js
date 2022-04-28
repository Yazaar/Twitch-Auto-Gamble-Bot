(function(){
    const clientId = 'plzvnzktffhy4r23znsp0x0j7x0d1w';

    let connectedAccount = document.querySelector('#connectedAccount span');
    let targetChannel = document.querySelector('#channel');
    let timeout = document.querySelector('#timeout');
    let bot = document.querySelector('#bot');
    let command = document.querySelector('#command');
    let msgFilter = document.querySelector('#msgFilter');
    let winRegex = document.querySelector('#winRegex');
    let startAmount = document.querySelector('#startAmount');
    let lowerLimit = document.querySelector('#lowerLimit');
    let balance = document.querySelector('#balance');
    let winrate = document.querySelector('#winrate span');
    let status = document.querySelector('#status span');
    let stopBeforeLowerLimit = document.querySelector('#stopBeforeLowerLimit');

    let token = loadToken();
    let ws = null;
    let wsIsOpen = false;

    let currentConnectedUsername;
    let currentConnectedId;

    let currentTargetChannel;
    let currentTargetChannelId;
    let currentTargetChannelMatch;
    let currentLowerLimit;
    let currentTimeout;
    let currentBot;
    let currentCommand;
    let currentWinRegex;
    let currentStartAmount;
    let currentMsgFilter;

    let wins = 0;
    let losses = 0;
    let currentBalance = 0;
    let currentAmount;
    let lastWin = true;
    let currentStopBeforeLowerLimit = false;

    let gambleInterval = null;
    let infoInterval = null;

    let doGamble = true;

    document.querySelector('#authenticate').href = 'https://id.twitch.tv/oauth2/authorize?client_id=' + clientId + '&response_type=token&force_verify=true&scope=chat:read%20chat:edit%20channel:moderate%20whispers:read%20whispers:edit&redirect_uri=' + window.location.origin + window.location.pathname;

    function loadToken() {
        let params = new URLSearchParams(window.location.hash.substring(1));
        window.location.hash = '';

        let token = params.get('access_token');

        if (token) {
            window.localStorage.setItem('TTVGambler::OAuth', token);
            return token;
        }

        return window.localStorage.getItem('TTVGambler::OAuth');
    }
    
    async function getUserId(username) {
        if (username.length === 0) {
            return null;
        }

        let resp = await fetch('https://api.twitch.tv/helix/users?login=' + username, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Client-Id': clientId
            }
        });

        let respJson = await resp.json();
        
        if (respJson.status >= 400 && respJson.status < 500) {
            alert(respJson.error + ': ' + respJson.message);
            return null;
        }

        if (!respJson.data?.length === 0) {
            return null;
        }

        return respJson.data[0].id;
    }
    
    async function isLive(userId) {
        let resp = await fetch('https://api.twitch.tv/helix/streams?user_id=' + userId, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Client-Id': clientId
            }
        });
    
        let respJson = await resp.json();
        
        if (respJson.status === 401) {
            alert(respJson.error + ': ' + respJson.message);
            return -1;
        }
    
        return respJson.data.length === 0 ? 0 : 1;
    }

    async function getAccountName(token) {
        let resp = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: {
                'Authorization': 'OAuth ' + token
            }
        });

        let respJson = await resp.json();

        if (respJson.status === 401 || respJson.expires_in === 0) {
            return null;
        }

        if (!respJson.scopes.includes('channel:moderate') ||
            !respJson.scopes.includes('chat:edit') ||
            !respJson.scopes.includes('chat:read') ||
            !respJson.scopes.includes('whispers:edit') ||
            !respJson.scopes.includes('whispers:read')) {
                return null;
        }

        return respJson.login;
    }

    async function setup() {
        let name = await getAccountName(token);
        if (name) {
            currentConnectedUsername = name.toLowerCase();
            connectedAccount.innerText = currentConnectedUsername;
            console.log('authenticated');
        } else {
            connectedAccount.innerText = '';
            token = null;
            window.localStorage.removeItem('TTVGambler::OAuth');
            console.log('not authenticated');
        }
    }
    
    function sendTTVMessage(message) {
        if (wsIsOpen) {
            ws.send("PRIVMSG #" + currentTargetChannel + " :" + message + "\r\n");
        } else {
            stop();
        }
    }
    
    function sendTTVInfo() {
        sendTTVMessage('/me [Yazaar Gamble Script] Is this script annoying you? If so, take action as the caster and type "--DisableGambleScript" to exit immediately! Sorry for the inconvenience...')
    }
    
    function limitBypassed() {
        console.log('Whoops... You seem to have bypassed your lower limit, sorry :) But I am disabling the auto gamble right now!');
        stop();
    }

    function onWSMessage(data) {
        let msg = data.data;

        if (msg === 'PING :tmi.twitch.tv\r\n') {
            ws.send('PONG :tmi.twitch.tv\r\n');
            return;
        }

        if (!msg.includes(' PRIVMSG #')) {
            if (msg.includes(':End of /NAMES list')) {
                console.log('Connected!');
                gambleLoop();
                gambleInterval = setInterval(gambleLoop, currentTimeout);
            }
            return;
        }
        
        let lowmsg = msg.toLowerCase();
        
        if (lowmsg.substring(0, currentTargetChannelMatch.length) === currentTargetChannelMatch && lowmsg.includes('--disablegamblescript')){
            console.log('The caster for the channel took action and disabled this script')
            sendTTVMessage('Got it, disabling the script right now')
            stop()
            return
        }
        
        if (lowmsg.substring(0, currentBot.length) !== currentBot){
            return;
        }

        if (!currentMsgFilter.test(msg)) {
            return;
        }
        
        lastWin = currentWinRegex.test(msg)
        if (lastWin) {
            wins++;
            currentBalance += currentAmount;
        } else {
            losses++;
            currentBalance -= currentAmount;
        }
        
        winrate.innerText = ((wins/(wins+losses))*100).toFixed(2);
        balance.innerText = currentBalance;
        
        if (currentBalance <= currentLowerLimit){
            limitBypassed();
        }

        doGamble = true;
    }

    function onWSOpen(msg) {
        console.log(msg);
        status.innerText = 'online';
        wsIsOpen = true;
        ws.send("PASS oauth:" + token + "\r\n");
        ws.send("NICK " + currentConnectedUsername + "\r\n");
        ws.send("JOIN #" + currentTargetChannel + "\r\n");
    }
    
    function onWSClose(msg) {
        console.log(msg);
        status.innerText = 'offline';
        wsIsOpen = false;
    }
    
    function onWSError(msg) {
        console.log(msg);
    }

    function gambleLoop() {
        if (!doGamble) {
            doGamble = true;
            return;
        }
        doGamble = false;

        if (lastWin) {
            currentAmount = currentAmount === currentStartAmount ? currentStartAmount+1 : currentStartAmount;
        } else {
            currentAmount = currentAmount * 2;
        }

        if (currentStopBeforeLowerLimit && currentBalance - currentAmount <= currentLowerLimit) {
            limitBypassed();
            return;
        }

        sendTTVMessage(currentCommand + ' ' + currentAmount);
    }

    function stop() {
        if (ws !== null) {
            ws.close();
            ws = null;
        }
        if (gambleInterval !== null) {
            clearInterval(gambleInterval);
            gambleInterval = null;
        }
        if (infoInterval !== null) {
            clearInterval(infoInterval);
            infoInterval = null;
        }
    }

    async function start() {
        if (!token) {
            alert('Invalid token, please authenticate');
            return;
        }

        currentTargetChannel = targetChannel.value.toLowerCase();
        currentTargetChannelId = await getUserId(currentTargetChannel);

        if (!currentTargetChannelId) {
            alert('Invalid channel target, does not exist');
            return;
        }
        
        let userLive = await isLive(currentTargetChannelId);
        if (userLive === 1) {
            alert('Channel target is live, I can not let you proceed using my script');
            return;
        } else if (userLive === -1) {
            return;
        }

        currentStopBeforeLowerLimit = stopBeforeLowerLimit.checked;
        currentBot = bot.value.toLowerCase();
        currentCommand = command.value;
        currentWinRegex = new RegExp(winRegex.value);
        currentMsgFilter = new RegExp(msgFilter.value);
        
        currentTimeout = parseInt(timeout.value);
        currentLowerLimit = parseInt(lowerLimit.value);
        currentStartAmount = parseInt(startAmount.value);

        currentAmount = null;

        currentBot = ':' + currentBot + '!' + currentBot + '@' + currentBot + '.tmi.twitch.tv'; 
        currentTargetChannelMatch = ':' + currentTargetChannel + '!' + currentTargetChannel + '@' + currentTargetChannel + '.tmi.twitch.tv'; 

        lastWin = true;

        if (isNaN(currentTimeout) || currentTimeout < 1) {
            alert('Invalid timeout, has to be an integer larger than 0');
            return;
        }
        if (isNaN(currentLowerLimit)) {
            alert('Invalid lower limit, has to be an integer');
            return;
        }
        if (isNaN(currentStartAmount) || currentStartAmount < 1) {
            alert('Invalid start amount, has to be an integer larger than 0');
            return;
        }

        stop();

        if (window.location.protocol === 'https:'){
            ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        } else {
            ws = new WebSocket('ws://irc-ws.chat.twitch.tv:80');
        }

        ws.onclose = onWSClose;
        ws.onmessage = onWSMessage;
        ws.onerror = onWSError;
        ws.onopen = onWSOpen;

        infoInterval = setInterval(sendTTVInfo, currentTimeout*8);
    }

    document.querySelector('#go').addEventListener('click', start);

    setup();
})();
