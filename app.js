﻿// <reference path="data/options/config.js" />
//Init
var reconnectInterval = 60000;
var ws;
var _stop = -1, _running = 1, _normal = 0;
var _status = _normal, cookie_base = 'GETAFREE';
var optionsObj, newprojects = [];
//Helper
function Login() {

    console.log('Open connection success'); //log the received message
    //var hashvalue, hash = cookie_base + '_AUTH_HASH';
    var authsend, hash2 = cookie_base + '_AUTH_HASH_V2';
    var authchannel, user_id = cookie_base + '_USER_ID';
    getListCookie("https://www.freelancer.com", [hash2, user_id], function (_return) {
        //hashvalue = _return[hash];
        authsend = '["{\\"channel\\":\\"auth\\",\\"body\\":{\\"hash2\\":\\"' + decodeURIComponent(_return[hash2]) + '\\",\\"user_id\\":' + _return[user_id] + '}}"]';
        authchannel = '["{\\"channel\\":\\"channels\\",\\"body\\":{\\"channels\\":['+ optionsObj.notification_skills.join(',') +']}}"]';
        console.log("list skill get notification: "+optionsObj.notification_skills.join(','));
        ws.send(authsend);
        ws.send(authchannel);
    });


}
var play = (function () {
    var audio;
    function initSound() {
        audio = document.createElement('audio');
        audio.setAttribute("preload", "auto");
        audio.autobuffer = true;
        var source = document.createElement('source');
        source.type = 'audio/wav';
        source.src = 'data/sounds/' + optionsObj.notification_sound_type;
        audio.appendChild(source);
    }

    return {
        now: function () {
            if (!audio) initSound();

            audio.volume = optionsObj.notification_sound_volume / 100;
            audio.load;
            audio.play();
        },
        reset: initSound
    }
})();
function notifyClear(idreturn) {
    console.log('clear: ' + idreturn);
    chrome.notifications.clear(idreturn, function () {
        var index = newprojects.indexOf(idreturn);
        newprojects.splice(index, 1);
        ShowCount(newprojects.length);
    });
}
function shorten(str) {
    str = str.replace(/\n/g, ' ').replace(/\s\s/g, ' ');
    if (str.length < optionsObj.notification_truncate) return str;
    return str.substr(0, optionsObj.notification_truncate / 2) + "..." + str.substr(str.length - optionsObj.notification_truncate / 2);
}
function timeSince(date) {

    var seconds = Math.floor((new Date() - date) / 1000);
  
    var interval = seconds / 31536000;
  
    if (interval > 1) {
      return Math.floor(interval) + " years";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + " months";
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + " days";
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return Math.floor(interval) + " hours";
    }
    interval = seconds / 60;
    if (interval > 1) {
      return Math.floor(interval) + " minutes";
    }
    return Math.floor(seconds) + " seconds";
  }
function showMessageDesktop(_obj) {
    var showNotify = false;
    if (optionsObj.notification_show) {

        var data = _obj.body && _obj.body.data;
        if (!data) {
            _obj = JSON.parse(_obj);
            data = _obj.body && _obj.body.data;
        }
        if (data && data.appended_descr) {
            showNotify = !new RegExp(data.userName, 'i').test(optionsObj.notification_ignore_uname);
            showNotify = showNotify && !new RegExp(optionsObj.notification_ignore_title, 'i').test(data.title);
            showNotify = showNotify && !new RegExp(optionsObj.notification_ignore_content, 'i').test(data.appended_descr);
            showNotify = showNotify && !new RegExp(optionsObj.notification_ignore_currency, 'i').test(data.currencyCode);
            if (showNotify) {
                //play sound
                if (optionsObj.notification_sound_play) {
                    play.now();
                }
                //show message
                var budget = '';
                if (data.maxbudget && data.minbudget) {
                    budget = data.minbudget + ' - ' +  data.maxbudget+ data.currencyCode;
                } else if (data.minbudget) {
                    budget = 'min ' + data.minbudget + data.currencyCode;
                } else if (data.maxbudget) {
                    budget = 'max ' + data.maxbudget  + data.currencyCode;
                } else if (data.projIsHourly) {
                    budget = "*Hourly*";
                }
                var _time=timeSince(new Date(data.submitDate+" EST"));

                var content = optionsObj.notification_format.replace("[job_string]", data.jobString)
                        .replace("[summary]", shorten(data.appended_descr))
                        .replace("[budget]", budget)
                    .replace("[user_name]", data.userName)
                    .replace("[time]", _time)
                .replace(/\[break\]/g, "\n");
                console.log(content);
                chrome.notifications.create(data.id + '', {
                    type: "basic",
                    title: data.title,
                    message: content,
                    iconUrl: "img/icon.png",
                    priority: parseInt(optionsObj.notification_priority)
                }, function (idreturn) {
                    newprojects[newprojects.length] = idreturn;
                    ShowCount(newprojects.length);
                    setTimeout(function () {
                        notifyClear(idreturn);
                    }, parseInt(optionsObj.notification_time_clear) * 1000);
                });
            } else {
                console.log('canceled notify object: data object show below');
                console.log(data);
            }

        } else {
            console.log('Other type notifications');
        }
    }

}
function errorLog(code, reason) {
    console.log('server error(' + code + '): ' + reason);
}
function parseMesssage(a) {
    var b = this,
        c = a.slice(0, 1);
    switch (c) {
        case 'o':
            console.log('start login');
            Login();
            break;
        case 'a':
            var d = JSON.parse(a.slice(1) || '[]');
            for (var e = 0; e < d.length; e++) showMessageDesktop(d[e]);
            break;
        case 'm':
            var d = JSON.parse(a.slice(1) || 'null');
            showMessageDesktop(d);
            break;
        case 'c':
            var d = JSON.parse(a.slice(1) || '[]');
            errorLog(d[0], d[1]);
            break;
        case 'h':
            console.log('empty response, wait for new project');
    }
}
var g = 'abcdefghijklmnopqrstuvwxyz0123456789_';
function random_string(a, b) {
    b = b || g.length;
    var c, d = [];
    for (c = 0; c < a; c++) d.push(g.substr(Math.floor(Math.random() * b), 1));
    return d.join('')
}
function random_number(a) {
    return Math.floor(Math.random() * a)
}
function random_number_string(a) {
    var b = ('' + (a - 1)).length,
        d = Array(b + 1).join('0');
    return (d + random_number(a)).slice(-b)
}
//Run Socket
var connect = function () {
    ws = new WebSocket('wss://notifications.freelancer.com/' + random_number_string(1e3) + '/' + random_string(8) + '/websocket');
    ws.onmessage = function (e) {
        console.log('onmessage websocket');
        //console.log(e.data);
        parseMesssage(e.data);
    };
    ws.onclose = function () {
        console.log('socket close');
        if (_status == _running) {

            setTimeout(connect, reconnectInterval);
        } else {
            console.log('socket close by User');
        }
    };
};
function ShowCount(_count) {
    chrome.browserAction.setBadgeText({ text: _count + '' });
    chrome.browserAction.setTitle({ title: _count + '' });
}

function getListCookie(domain, keys, callback) {
    //"https://www.freelancer.com"

    var key = keys.shift();
    var _returnObj = {};
    function getCk(_domain, _key, _callback) {
        chrome.cookies.get({ 'url': _domain, 'name': _key }, function (ck) {
            if (ck) {
                _callback(ck.value);
            }
        });
    }
    function next(_value) {
        _returnObj[key] = _value;
        if (keys.length > 0) {
            key = keys.shift();
            getCk(domain, key, next);
        } else {
            callback(_returnObj);
        }
    }
    getCk(domain, key, next);
}
function restartListen(newoptions) {
    if (_status == _running) {
        console.log('Restart listen');
        ShowCount('off');
        _status = _stop;
        ws.close();
        chrome.storage.local.get('options', function (data) {
            optionsObj = newoptions || optionsDefault;
            ShowCount('on');
            _status = _running;
            connect();
        });
    }
}
function startListen() {
    if (_status == _running) {
        if (confirm('do you want stop recieve new jobs ?')) {
            ShowCount('off');
            _status = _stop;
            ws.close();
        }
    } else {
        chrome.storage.local.get('options', function (data) {
            optionsObj = data['options'] || optionsDefault;
            ShowCount('on');
            _status = _running;
            connect();
        });

    }
}
//reg event
chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.get('options', function (data) {
        optionsObj = data['options'] || optionsDefault;
        if (optionsObj.notification_welcome) {
            window.open('/data/options/options.html', '_blank');
            
        }
    });

});
chrome.notifications.onClicked.addListener(function (notificationId) {
    notifyClear(notificationId);
    window.focus();
    var url = "https://www.freelancer.com/projects/" + notificationId + ".html";
    window.open(url, '_blank');
});
chrome.storage.local.get('options', function (data) {
    optionsObj = data['options'] || optionsDefault;
    if (optionsObj.notification_startup) {
        startListen();
    }
});
chrome.browserAction.onClicked.addListener(function () {
    startListen();
});
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (optionsObj && request._method == "updateConfig") {
            if (optionsObj.notification_skills.join('') != request.options.notification_skills.join('')) {

                restartListen(request.options);
            }
        } optionsObj = request.options;
        sendResponse(false);
    });