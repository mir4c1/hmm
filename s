// ==UserScript==
// @name            Gartic anti3
// @version          10.5
// @match            *://gartic.io/*
// @run-at           document-start
// @grant            unsafeWindow
// ==/UserScript==

;(function(){
'use strict';
var win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
    tokens = [], fetching = false, cIdx = 0,
    _owner = win._owner || (win._owner = {});

// --- ANTI-KICK DEĞİŞKENLERİ ---
var myBotID = null, myLongID = null, isRejoinInProgress = false, gameSocket = null, kickCooldown = false;

// --- VOTEKICK TAKİBİ ---
var voteTracker = {};

function getVoteThreshold(userCount) {
    return Math.max(2, Math.ceil((userCount + 1) / 3));
}

function resetVoteTracker() {
    voteTracker = {};
}

// WebSocket hook
(function hookWebSocket(){
    var OrigWS = win.WebSocket;
    win.WebSocket = function(){
        var ws = new (Function.prototype.bind.apply(OrigWS, [null].concat(Array.prototype.slice.call(arguments))))();
        gameSocket = ws;
        var eskiSend=ws.send;
        ws.send=function(data){
            try{
                if(typeof data==='string'&&data.indexOf('42')===0){
                    var paket=JSON.parse(data.slice(2));
                    if((paket[0]===3||paket[0]==='3')&&paket[1]&&typeof paket[1]==='object'){
                        paket[1].nick='userallah';
                        data='42'+JSON.stringify(paket);
                    }
                }
            }catch(x){}
            return eskiSend.call(this,data);
        };

        ws.addEventListener('message', function(e){
            try {
                var msg = e.data;

                // Odaya giriş — ID'leri al
                if(msg.indexOf('42["5"') !== -1){
                    var parsed = JSON.parse('["5"' + msg.split('42["5"')[1]);
                    myLongID = parsed[1];
                    myBotID  = parsed[2];
                    resetVoteTracker();
                }

                // --- VOTEKICK EVENT ---
                if(msg.indexOf('42[45,') !== -1 || msg.indexOf('42["45"') !== -1){
                    try {
                        var rawStart = msg.indexOf('42[45,') !== -1
                            ? msg.indexOf('42[45,')
                            : msg.indexOf('42["45"');
                        var rawArr = JSON.parse(msg.substring(rawStart + 2));
                        var targetId  = rawArr[2];
                        var voteCount = rawArr[3];

                        if(targetId === myBotID || targetId === myLongID){
                            voteTracker[targetId] = voteCount;
                            var userCount = 0;
                            try {
                                var gameObj = _owner._game;
                                if(gameObj && gameObj.users) userCount = gameObj.users.length;
                            } catch(x){}
                            var threshold = getVoteThreshold(userCount);
                            if(voteCount >= threshold - 1 && !isRejoinInProgress && !kickCooldown){
                                isRejoinInProgress = true;
                                kickCooldown = true;
                                try {
                                    if(gameSocket && gameSocket.readyState === 1)
                                        gameSocket.send('42[24,' + myBotID + ']');
                                } catch(x){}
                                setTimeout(function(){
                                    try { var p = _owner._play; if(p && p._socket) p._socket.disconnect(); } catch(x){}
                                    try { if(gameSocket && gameSocket.readyState !== 3) gameSocket.close(); } catch(x){}
                                    try { if(_owner._game) delete _owner._game; } catch(x){}
                                    resetVoteTracker();
                                    setTimeout(function(){
                                        try {
                                            var p = _owner._play;
                                            if(p && p._lastJoinArgs){
                                                var a = p._lastJoinArgs;
                                                if(a.data) a.data.timeExit = 0;
                                                p.start(a.data, a.room, a.viewer);
                                            }
                                        } catch(x){}
                                        setTimeout(function(){ isRejoinInProgress = false; }, 5000);
                                    }, 800);
                                }, 300);
                            }
                        }
                    } catch(x){}
                }

                // Admin/owner kick — event 39
                if(msg.indexOf('42[39,') !== -1 || msg.indexOf('42["39"') !== -1){
                    try {
                        var kickRaw = msg.indexOf('42[39,') !== -1
                            ? msg.indexOf('42[39,')
                            : msg.indexOf('42["39"');
                        var kickArr = JSON.parse(msg.substring(kickRaw + 2));
                        var kickedId = kickArr[1];
                        if((kickedId === myBotID || kickedId === myLongID) && !isRejoinInProgress && !kickCooldown){
                            isRejoinInProgress = true;
                            kickCooldown = true;
                            try {
                                if(gameSocket && gameSocket.readyState === 1)
                                    gameSocket.send('42[24,' + myBotID + ']');
                            } catch(x){}
                            setTimeout(function(){
                                try { var p = _owner._play; if(p && p._socket) p._socket.disconnect(); } catch(x){}
                                try { if(gameSocket && gameSocket.readyState !== 3) gameSocket.close(); } catch(x){}
                                try { if(_owner._game) delete _owner._game; } catch(x){}
                                resetVoteTracker();
                                setTimeout(function(){
                                    try {
                                        var p = _owner._play;
                                        if(p && p._lastJoinArgs){
                                            var a = p._lastJoinArgs;
                                            if(a.data) a.data.timeExit = 0;
                                            p.start(a.data, a.room, a.viewer);
                                        }
                                    } catch(x){}
                                    setTimeout(function(){ isRejoinInProgress = false; }, 5000);
                                }, 800);
                            }, 300);
                        }
                    } catch(x){}
                }

                // Doğrudan kick
                if(msg.includes('42["45"') || msg.includes('42[45,')){
                    var kickData;
                    try {
                        if(msg.startsWith('42["45"')) kickData = JSON.parse(msg.substring(2));
                        else if(msg.startsWith('42[45,')) kickData = JSON.parse(msg.substring(2));
                    } catch(x){}
                    if(kickData && kickData.length === 3){
                        var kickedID = kickData[2];
                        if((kickedID === myBotID || kickedID === myLongID) && !isRejoinInProgress && !kickCooldown){
                            isRejoinInProgress = true;
                            kickCooldown = true;
                            try {
                                if(gameSocket && gameSocket.readyState === 1)
                                    gameSocket.send('42[24,' + myBotID + ']');
                            } catch(x){}
                            setTimeout(function(){
                                try { var p = _owner._play; if(p && p._socket) p._socket.disconnect(); } catch(x){}
                                try { if(gameSocket && gameSocket.readyState !== 3) gameSocket.close(); } catch(x){}
                                try { if(_owner._game) delete _owner._game; } catch(x){}
                                resetVoteTracker();
                                setTimeout(function(){
                                    try {
                                        var p = _owner._play;
                                        if(p && p._lastJoinArgs){
                                            var a = p._lastJoinArgs;
                                            if(a.data) a.data.timeExit = 0;
                                            p.start(a.data, a.room, a.viewer);
                                        }
                                    } catch(x){}
                                    setTimeout(function(){ isRejoinInProgress = false; }, 5000);
                                }, 800);
                            }, 400);
                        }
                    }
                }
            } catch(err){}
        });

        return ws;
    };

    win.WebSocket.prototype = OrigWS.prototype;
    Object.defineProperty(win.WebSocket, 'CONNECTING', { value: OrigWS.CONNECTING });
    Object.defineProperty(win.WebSocket, 'OPEN',       { value: OrigWS.OPEN });
    Object.defineProperty(win.WebSocket, 'CLOSING',    { value: OrigWS.CLOSING });
    Object.defineProperty(win.WebSocket, 'CLOSED',     { value: OrigWS.CLOSED });
})();

(function injectCSS(){
    var css = [
        '.anima { display:none !important; }',
        '#popUp:has(.contentPopup.rules) { display:none !important; visibility:hidden !important; opacity:0 !important; pointer-events:none !important; }',
        '#gartic-load { position:fixed; inset:0; z-index:999998; display:flex; align-items:center; justify-content:center; background:rgba(5,10,18,.24); backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px); pointer-events:none; }',
        '#gartic-load .wrap { width:60px; height:60px; position:relative; }',
        '#gartic-load .arc { position:absolute; inset:0; border-radius:50%; border:2.5px solid transparent; }',
        '#gartic-load .a1 { border-top:2.5px solid #e2e2e2; animation:gartic-spin 1s ease-in-out infinite; }',
        '#gartic-load .a2 { border-right:2.5px solid #555; animation:gartic-spin 1s ease-in-out infinite; animation-delay:-.5s; }',
        '@keyframes gartic-spin { to { transform:rotate(360deg); } }'
    ].join('');
    var inject = function(){
        if(document.getElementById('gartic-hide-popups')) return;
        var s = document.createElement('style');
        s.id = 'gartic-hide-popups';
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    };
    document.head ? inject() : new MutationObserver(function(_,b){
        if(document.head||document.documentElement){ b.disconnect(); inject(); }
    }).observe(document.documentElement,{childList:1,subtree:1});
})();

var tokenomru=35e3, userPrewarm={key:null,promise:null};

function userhazirla(user){
    if(!user) return Promise.resolve();
    var payload={name:user.nome,avatar:user.avatar,language:user.language},key=JSON.stringify(payload);
    if(userPrewarm.key===key&&userPrewarm.promise) return userPrewarm.promise;
    userPrewarm.key=key;
    userPrewarm.promise=fetch('/req/user',{
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(payload)
    }).then(function(r){ if(!r.ok) throw new Error('user request '+r.status); return r; })
    .catch(function(e){ userPrewarm.key=null; userPrewarm.promise=null; throw e; });
    return userPrewarm.promise;
}

function yuklemeAc(){
    if(document.getElementById('gartic-load')) return;
    var el=document.createElement('div');
    el.id='gartic-load';
    el.innerHTML='<div class="wrap"><div class="arc a1"></div><div class="arc a2"></div></div>';
    (document.body||document.documentElement).appendChild(el);
}
function yuklemeKapat(){
    var el=document.getElementById('gartic-load');
    if(el) el.remove();
}

function prefetch(){
    if(fetching||tokens.length>=1||!win.turnstile) return;
    fetching=true; cIdx++;
    var id='ptc-'+cIdx, el=document.createElement('div');
    el.id=id;
    el.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(el);

    var pollTimer=null, seenToken=null;

    function onToken(t){
        if(seenToken===t) return;
        seenToken=t;
        if(pollTimer){ clearInterval(pollTimer); pollTimer=null; }
        tokens.push({t:t,ts:Date.now(),w:wid,c:id});
        fetching=false;
    }

    var wid=win.turnstile.render('#'+id,{
        sitekey:'0x4AAAAAABBPKaIbNwnPEfSo', action:'join', appearance:'always',
        callback:function(t){ onToken(t); },
        'error-callback':function(){
            if(pollTimer){ clearInterval(pollTimer); pollTimer=null; }
            fetching=false;
            win.turnstile.remove(wid);
            document.getElementById(id)&&document.getElementById(id).remove();
            setTimeout(prefetch,3e3);
        },
        'timeout-callback':function(){
            if(pollTimer){ clearInterval(pollTimer); pollTimer=null; }
            fetching=false;
            win.turnstile.remove(wid);
            document.getElementById(id)&&document.getElementById(id).remove();
            setTimeout(prefetch,1e3);
        }
    });

    var pollStart=Date.now();
    pollTimer=setInterval(function(){
        var inp=document.querySelector('#'+id+' input[name="cf-turnstile-response"]');
        if(inp&&inp.value&&inp.value.length>20){
            onToken(inp.value);
            return;
        }
        if(Date.now()-pollStart>30000){
            clearInterval(pollTimer); pollTimer=null;
            fetching=false;
            try{ win.turnstile.remove(wid); }catch(x){}
            var dead=document.getElementById(id);
            if(dead) dead.remove();
            setTimeout(prefetch,2e3);
        }
    },300);
}
function consume(t){ setTimeout(function(){ win.turnstile.remove(t.w); document.getElementById(t.c)&&document.getElementById(t.c).remove(); },1e3); }

var tsi=setInterval(function(){ if(win.turnstile){ clearInterval(tsi); prefetch(); } },100);
setInterval(function(){
    var now=Date.now(),old=tokens.length;
    tokens=tokens.filter(function(t){ if(now-t.ts>=tokenomru){ consume(t); return false; } return true; });
    if(old>tokens.length) prefetch();
},10e3);

function observe(s,c,r){
    var f=function(){ document.querySelectorAll(s).forEach(c); o.observe(document.body,{childList:1,subtree:1}); };
    var o=new MutationObserver(function(m){
        for(var i=0;i<m.length;i++) for(var j=0;j<m[i].addedNodes.length;j++){
            var n=m[i].addedNodes[j];
            if(n.nodeType==1&&(n.matches?.(s)||n.querySelector?.(s))){
                n.matches?.(s)&&c(n); n.querySelectorAll?.(s).forEach(c);
                if(!r) return o.disconnect();
            }
        }
    });
    document.body?f():new MutationObserver(function(_,b){ if(document.body){b.disconnect();f();} }).observe(document.documentElement,{childList:1});
}

observe('div#content',function(el){
    var delays=[50,100,200,400,800,1600],idx=0;
    (function tryFind(){
        var key=Object.getOwnPropertyNames(el).find(function(x){return x.startsWith('__react');}),r=key&&el[key];
        if(!r){ if(delays[idx]!==undefined)setTimeout(tryFind,delays[idx++]); return; }
        try{ var play=r.pendingProps.children[1]._owner.stateNode._play; _owner._play=play; patch(play); }
        catch(e){ if(delays[idx]!==undefined)setTimeout(tryFind,delays[idx++]); }
    })();
},0);

observe('div#screenRoom',function(el){
    var walk=function(n){
        if(!n) return;
        if(n.tag===1){
            var g=n.stateNode?.props?.children?.[0]?._owner?.stateNode?._game;
            if(g&&g!==_owner._game){
                _owner._game=g;
                onJoin(g);
                return;
            }
        }
        walk(n.child);
    };
    for(var k in el) if(k.startsWith('__react')) walk(el[k]);
},0);

function patch(p){
    if(p._data&&p._data.user){
        userhazirla(p._data.user).catch(function(){});
    }

    p._getTurnstileToken=function(){
        return new Promise(function(res,rej){
            if(tokens.length>0){ var t=tokens.shift(); res(t.t); consume(t); setTimeout(prefetch,2e3); return; }
            prefetch();
            var ci=setInterval(function(){ if(tokens.length>0){ clearInterval(ci); var t=tokens.shift(); res(t.t); consume(t); setTimeout(prefetch,500); } },25);
            setTimeout(function(){ clearInterval(ci); rej('timeout'); },3e4);
        });
    };

    p._getServer=function(){
        var self=this,
            data=self._data||{},
            user=data.user||{},
            room=self._room&&self._room!==true?self._room:null,
            endpoint=self._viewer?'/serverViewer?v3=1':'/server?check=1&v3=1',
            query=[];
        if(room) query.push('room='+encodeURIComponent(room));
        if(!self._viewer&&!room&&user.language!==undefined) query.push('lang='+encodeURIComponent(user.language));
        return userhazirla(user).then(function(){
            return fetch(endpoint+(query.length?'&'+query.join('&'):''),{
                method:'GET', credentials:'include',
                headers:{'Accept':'application/json,text/plain,*/*'}
            });
        }).then(function(r){ if(!r.ok) throw new Error('server request '+r.status); return r.text(); })
        .then(function(result){
            if(result&&result.charAt(0)!=='x'){
                self._connectServer(result);
            }else if(result==='xx'){
                self._setPopup(2,{title:self._lang.error,text:self._lang.banned});
            }else{
                self._setPopup(2,{title:self._lang.error,text:self._lang.alreadyPlaying});
            }
        }).catch(function(error){
            yuklemeKapat();
            self._setData({creating:false});
            self._setPopup(2,{title:self._lang.error,text:self._lang.connectionLost});
        });
    };

    var origExit=p._exit;
    p.start=function(data,room,viewer){
        if(!data) data=win.CACHE_DATA||{};
        p._lastJoinArgs={data:data,room:room,viewer:viewer};
        if(data.timeExit&&Date.now()-data.timeExit<=15e3) data.timeExit=0;
        p._data=data; p._room=room; p._viewer=!!viewer;
        yuklemeAc();
        userhazirla(data.user);
        p._getTurnstileToken().then(function(tk){
            p._token=tk;
            p._getServer();
        }).catch(function(e){
            yuklemeKapat();
            p._setData({creating:false});
        });
    };
    win.garticHizliGiris=function(room,nick){
        var data=win.CACHE_DATA||{};
        data.user=data.user||{};
        if(nick)data.user.nome=nick;
        p.start(data,room,false);
    };

    p._exit=function(code,msg){
        origExit.call(this,code,msg);
        if(isRejoinInProgress) return;
        if(code===null||code===undefined){ prefetch(); return; }
        if([1,2,7,9].indexOf(code)!==-1&&p._lastJoinArgs){
            try{ p._socket&&p._socket.disconnect(); }catch(x){}
            var a=p._lastJoinArgs;
            setTimeout(function(){ if(a.data)a.data.timeExit=0; p.start(a.data,a.room,a.viewer); },1500);
        } else prefetch();
    };
}

function onJoin(game){
    yuklemeKapat();
    isRejoinInProgress = false;
    resetVoteTracker();
    setTimeout(function(){ kickCooldown = false; }, 500);

    if(game&&!game.__afkNativeBagli){
        var aktiflik=function(){
            try{ if(typeof game.active==='function') game.active(); }catch(x){}
        };
        try{
            if(typeof game.prependListener==='function'){
                game.prependListener('avisoInativo',aktiflik);
                game.__afkNativeBagli=true;
            }else if(typeof game.on==='function'){
                game.on('avisoInativo',aktiflik);
                game.__afkNativeBagli=true;
            }
        }catch(x){}
    }

    var room=document.querySelector('#screenRoom');
    if(room&&!room.__directExitBound){
        room.__directExitBound=true;
        room.addEventListener('click',function(e){
            var target=e.target&&e.target.closest?e.target.closest('button,a,[role="button"],div,span'):null;
            if(!target) return;
            var signature=(String(target.className||'')+' '+String(target.id||'')+' '+String(target.getAttribute('aria-label')||'')+' '+String(target.getAttribute('title')||'')).toLowerCase();
            if(/(^|[ _-])(denounce|report|complain|sikayet|şikayet)([ _-]|$)/.test(signature)){
                e.preventDefault(); e.stopPropagation();
                try{ game.report(); }catch(x){}
                return;
            }
            if(target.closest('#popUp,.contentPopup,[class*="popup"]')) return;
            if(!/(^|[ _-])(exit|leave|close|quit)([ _-]|$)/.test(signature)) return;
            e.preventDefault(); e.stopPropagation();
            try{ game.exit(); }catch(x){}
            delete _owner._game;
        },true);
    }
    addEventListener('keydown',function(e){
        if(e.code==='Escape'){
            e.preventDefault();
            try{ game.exit(); }catch(x){}
            delete _owner._game;
        }
    },{passive:false,once:true});
}

})();
