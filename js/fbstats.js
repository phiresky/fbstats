/**
* source: https://github.com/phiresky/fbstats
*/
var user = {
    userID: "unknown"
};

var TimeGrouping;
(function (TimeGrouping) {
    TimeGrouping[TimeGrouping["daily"] = 0] = "daily";
    TimeGrouping[TimeGrouping["weekly"] = 1] = "weekly";
    TimeGrouping[TimeGrouping["monthly"] = 2] = "monthly";
    TimeGrouping[TimeGrouping["END"] = 3] = "END";
})(TimeGrouping || (TimeGrouping = {}));

var visibleGraphs = [];
var plotcolors = ["#942727", "#5DA5DA", "#FAA43A", "#60BD68", "#F17CB0", "#B2912F", "#B276B2", "#DECF3F", "#F15854", "#4D4D4D"];
function getColor(tid, isIn) {
    var color;
    if (tid == -1)
        color = otherColor;
    else
        color = plotcolors[tid % plotcolors.length];
    return toRGBA(hexToRGB(color, isIn ? 1.0 : 0.8));
}
var otherColor = "#999999";
var scales = {
    "linear": {},
    "sqrt": {
        inversetransform: function (v) {
            return v * v;
        },
        transform: function (v) {
            return Math.sqrt(v);
        }
    },
    "log": {
        inversetransform: function (v) {
            return Math.exp(v) - 1;
        },
        transform: function (v) {
            return Math.log(v + 1);
        }
    }
};

function threadName(t, thread, maxlength) {
    if (typeof maxlength === "undefined") { maxlength = 10000; }
    if (t == -1)
        return "Other";
    if (Settings.anonymous)
        return "Person " + t;
    var str = $.map(thread.people, function (p) {
        return p.name || p.id;
    }).join(", ");
    if (str.length > maxlength - 3)
        return str.substring(0, maxlength - 1) + "…";
    return str;
}

function hexToRGB(hex, multiply) {
    var hexInt = parseInt(hex.substring(1), 16);
    var r = hexInt >> 16;
    var g = hexInt >> 8 & 0xFF;
    var b = hexInt & 0xFF;
    return [r * multiply, g * multiply, b * multiply];
}

function toRGBA(hex, a) {
    if (typeof a === "undefined") { a = 1; }
    return "rgba(" + hex.map(function (x) {
        return (x | 0);
    }).join(",") + "," + a + ")";
}

/**
* sets all threads as active and gets them
* @param {number} max
*/
function getAll(max, min) {
    if (typeof max === "undefined") { max = Statistics.threads.length; }
    if (typeof min === "undefined") { min = 0; }
    if (max === null)
        max = Statistics.threads.length;
    visibleGraphs = [];
    for (var i = min; i < max; i++)
        visibleGraphs.push(i);
    Statistics.graphMessages();
}

function getAllVisible() {
    getAll(Settings.maxThreadCount);
}

function getAllInvisible() {
    getAll(null, Settings.maxThreadCount);
}

function login() {
    FB.login(function (response) {
        if (response.authResponse) {
            user = response.authResponse;
            checkPerms();
        } else {
            document.location.reload();
        }
    }, {
        scope: 'read_mailbox'
    });
}

function start() {
    $("#logintext").text("Loading local cache");
    setTimeout(function () {
        var loaded = Statistics.load();
        $("<a/>", {
            "class": "btn btn-lg btn-primary centered",
            html: "<span id=threadload>Gathering statistics</span> <img src=loader.gif alt=\"loading..\">"
        }).appendTo("#threadcount");
        $("<a/>", {
            class: "btn btn-lg btn-primary centered",
            html: "Select a person on the left",
            id: "rswait"
        }).appendTo("#threadtime");
        if (loaded) {
            Statistics.graphThreads();
        } else {
            Statistics.countThreads();
        }
        $("#loginbutton").fadeOut();
    }, 500);
}

/**
* @param {string} appid
*/
function init(appid) {
    var butt = $("#loginbutton");
    var txt = $("#logintext");
    var img = butt.children("img");
    butt.show();
    txt.text("Logging in to Facebook");
    FB.init({
        appId: appid,
        xfbml: false,
        cookie: true
    });
    FB.getLoginStatus(function (response) {
        switch (response.status) {
            case "connected":
                txt.text("Checking permissions");
                user = response.authResponse;
                checkPerms();
                break;
            case "not_authorized":
            case "unknown":
            default:
                txt.text("Login to Facebook");
                img.hide();
                butt.click(login);
                break;
        }
    });
    $("#threadcount").parent().resizable();
    $("#threadtime").parent().resizable();
}

function checkPerms() {
    FB.api("/me/permissions", "get", function (e) {
        if (e.data[0].permission === "installed") {
            for (var i = 0; i < e.data.length; i++) {
                if (e.data[i].permission === "read_mailbox" && e.data[i].status === "granted") {
                    start();
                    return;
                }
            }
        }
        if (!e.data[0].read_mailbox) {
            console.log(e.data);
            $("#logintext").text("Could not access message data");
            $("#loginbutton>img").hide();
        } else {
            start();
        }
    });
}

function log(e) {
    console.groupCollapsed(e.callee.name);
    for (var i in e)
        console.log(e[i]);
    console.trace();
    console.groupEnd();
}

function mapTimestampsToDays(tid, messages) {
    var days = {};
    if (messages.length == 0) {
        //console.log("warn: tried to map zero length array (thread "+tid+")");
        return null;
    }
    var current = new Date(0);
    var next = new Date(messages[0].timestamp);
    next.setHours(0);
    next.setMinutes(0);
    next.setSeconds(0);
    next.setMilliseconds(0);
    switch (Settings.Graph.grouping) {
        case 1 /* weekly */:
            next.setDate(next.getDate() - next.getDay());
            break;
        case 2 /* monthly */:
            next.setDate(1);
            break;
    }

    for (var i = 0; i < messages.length; i++) {
        var messageDate = new Date(messages[i].timestamp);
        if (messageDate.getTime() < next.getTime()) {
            days[current.getTime()]++;
        } else {
            current = new Date(next.getTime());

            //TODO: new Date not needed just use timestamp
            days[current.getTime()] = 0;
            next.addInterval(1);
        }
    }
    var dayArray = [];
    for (var s = 0; s < Settings.Graph.smoothAmount; s++) {
        var days2 = {};
        var a = 0, b = 0, c = 0;
        for (var day in days) {
            c = b;
            b = a;
            a = day;
            if (b == 0)
                continue;
            if (c == 0) {
                days2[b] = (days[b] + days[a]) / 3;
                continue;
            }
            days2[b] = (days[b] + days[a] + days[c]) / 3;
        }
        days2[a] = (days[a] + days[b]) / 3;
        days = days2;
    }

    for (day in days) {
        dayArray.push([day, days[day]]);
    }
    return dayArray;
}

function FBfql(a, b) {
    log(arguments);
    FB.api({
        method: 'fql.query',
        query: a
    }, b);
}

function storageSetObject(key, value) {
    localStorage.setItem(key, LZString.compressToUTF16(JSON.stringify(value)));
}

function storageGetObject(key) {
    var value = localStorage.getItem(key);
    return value && JSON.parse(LZString.decompressFromUTF16(value));
}

function addSeries(label, threadID, messages, mapped) {
    if (Settings.Graph.separateInOut) {
        var dataIn = mapTimestampsToDays(threadID, messages.filter(function (m) {
            return m.from.id !== user.userID;
        }));
        var dataOut = mapTimestampsToDays(threadID, messages.filter(function (m) {
            return m.from.id === user.userID;
        }));
        if (dataIn !== null)
            mapped.push({
                label: label + "|In",
                stack: (Settings.Graph.stackThreads ? 1 : threadID) + (Settings.Graph.stackInOut ? 0 : 1e9),
                color: getColor(threadID, true),
                data: dataIn
            });
        if (dataOut !== null)
            mapped.push({
                label: label + "|Out",
                stack: (Settings.Graph.stackThreads ? 1 : threadID),
                color: getColor(threadID, false),
                data: dataOut
            });
    } else {
        mapped.push({
            label: label,
            stack: Settings.Graph.stackThreads ? "true" : null,
            color: getColor(threadID, true),
            data: mapTimestampsToDays(threadID, messages)
        });
    }
}

Date.prototype.getWeek = function () {
    var onejan = new Date(this.getFullYear(), 0, 1);
    return Math.ceil((((this.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
};
Date.prototype.addInterval = function (i) {
    switch (Settings.Graph.grouping) {
        case 2 /* monthly */:
            this.setMonth(this.getMonth() + i);
            break;
        case 1 /* weekly */:
            this.setDate(this.getDate() + 7 * i);
            break;
        case 0 /* daily */:
            this.setDate(this.getDate() + i);
            break;
    }
};
$(function () {
    loadSettings();
    var butt = $("#loginbutton");
    var txt = $("#logintext");
    var img = butt.children("img");
    butt.hide();
    $("#appidform").submit(function () {
        try  {
            event.preventDefault();
            init($("#appidinput").val());
            $("#settings").show();
            $(this).hide();
        } catch (e) {
            $(".errormessage").append(e).fadeIn();
            throw e;
        }
    });
    var scaleselect = $("#scaleselect").change(function () {
        Settings.Graph.scale = $(this).val();
        Statistics.graphThreads();
        Statistics.graphMessages();
    });
    for (var s in scales) {
        $("<option/>").text(s).appendTo(scaleselect);
    }

    $(".fbstats-bool").on("change", function () {
        var setting = this.dataset.setting;
        if (eval(setting) === undefined)
            throw new Error("unknown setting " + setting);
        eval(setting + '=' + this.checked);
        if (this.dataset.norefresh === undefined) {
            if (this.dataset.redrawThreads !== undefined)
                Statistics.graphThreads();
            Statistics.graphMessages();
        }
    }).each(function () {
        this.checked = eval(this.dataset.setting);
    });

    $("#groupingselect").change(function () {
        Settings.Graph.grouping = +TimeGrouping[this.value];
        Statistics.graphThreads();
        Statistics.graphMessages();
    });

    $("#threadcountinput").change(function () {
        var c = $(this).val() || 15;
        if (c < 3)
            c = 3;
        if (c > 50)
            c = 50;
        $(this).val(c);
        Settings.maxThreadCount = c;
        Statistics.graphThreads();
    });

    $(window).on("beforeunload", function () {
        saveSettings();
        if (Statistics.lastUpdate && Statistics.threads.length > 0)
            Statistics.save();
    });
});
//} catch(e) {$(".errormessage").append(e).fadeIn();throw e;}
var Message = (function () {
    function Message(timestamp, message, from, attachments) {
        this.timestamp = timestamp;
        this.message = message;
        this.from = from;
        this.attachments = attachments;
    }
    return Message;
})();
var Thread = (function () {
    function Thread(inputobj) {
        this.messages = [];
        this.people = [];
        this.count = parseInt(inputobj.num_messages || "0", 10);
        this.people = [];
        this.id = inputobj.thread_id;
        for (var i = 0; i < inputobj.participants.length; i++) {
            var p = new Person(inputobj.participants[i]);
            if (p.id == user.userID)
                continue;
            this.people.push(p);
        }
    }
    return Thread;
})();
var Person = (function () {
    function Person(inputobj) {
        this.id = inputobj.user_id || "0";
        this.name = (typeof inputobj.name == "undefined") ? "Andere" : inputobj.name;
    }
    return Person;
})();
var Statistics = (function () {
    function Statistics() {
    }
    Statistics.save = function () {
        localStorage.setItem("lastUpdate", "" + Statistics.lastUpdate);
        localStorage.setItem("fbstatsversion", Statistics.version);
        if (Statistics.lastUpdate == 0)
            Statistics.threads = [];
        storageSetObject("threads", Statistics.threads);
    };
    Statistics.load = function () {
        var last = localStorage.getItem("lastUpdate");
        var savedversion = localStorage.getItem("fbstatsversion");
        if (savedversion !== Statistics.version || !last || (Date.now() - parseInt(last, 10) > 1000 * Settings.cacheTime))
            return false;

        //could not load/cache too old
        Statistics.threads = storageGetObject("threads");
        return true;
    };
    Statistics.countThreads = function (offset) {
        if (typeof offset === "undefined") { offset = 0; }
        var query = "select participants,num_messages,thread_id from unified_thread where folder='inbox' LIMIT " + Settings.AJAX.threadGetLimit + " OFFSET " + offset;
        FBfql(query, function (response) {
            if (!$.isArray(response)) {
                //error
                $("#threadload").text("Error " + response.error_code + ": " + response.error_msg);
                console.log("Error: ", response);
                return;
            }

            for (var i = 0; i < response.length; i++) {
                //console.log(response[i]);
                if (response[i].num_messages < Settings.ignoreBelowMessageCount)
                    continue;
                Statistics.threads.push(new Thread(response[i]));
            }
            $("#threadload").text("Getting thread " + Statistics.threads.length);
            if (response.length == 0) {
                Statistics.threads.sort(function (a, b) {
                    return b.count - a.count;
                });
                Statistics.lastUpdate = Date.now();
                Statistics.graphThreads();
            } else {
                Statistics.countThreads(offset + response.length);
            }
        });
    };
    Statistics.graphThreads = function () {
        Statistics.reducedThreads = [];
        var otherCount = 0;
        for (var i = 0; i < Statistics.threads.length; i++) {
            if (i >= Settings.maxThreadCount)
                otherCount += Statistics.threads[i].count;
            else
                Statistics.reducedThreads.push(Statistics.threads[i]);
        }
        var data = [$.map(Statistics.reducedThreads, function (t, i) {
                return [[t.count, threadName(i, t)]];
            })];
        data[0].push([otherCount, "Other"]);

        //window.dat2a=data;
        Statistics.threadPlot = $.plot($("#threadcount"), data, {
            series: {
                bars: {
                    show: true,
                    align: "center",
                    barWidth: 0.6,
                    horizontal: true,
                    color: toRGBA(hexToRGB("#ffc508", 1), 0.8),
                    fillColor: toRGBA(hexToRGB("#ffc508", 1), 0.5)
                },
                highlightColor: toRGBA(hexToRGB("#00bd10", 1), 0.5)
            },
            grid: {
                hoverable: true,
                clickable: true,
                autoHighlight: false
            },
            yaxis: {
                mode: "categories",
                transform: function (a) {
                    return -a;
                },
                inverseTransform: function (a) {
                    return -a;
                }
            },
            xaxis: jQuery.extend({
                position: "top"
            }, scales[Settings.Graph.scale])
        });
        $("#threadcount").off("plotclick").off("plothover").on("plothover", function (evt, pos, itm) {
            if (!itm)
                document.body.style.cursor = 'default';
            else if (itm.datapoint[1] < Settings.maxThreadCount)
                document.body.style.cursor = 'pointer';
        }).on("plotclick", function (evt, pos, itm) {
            if (!itm)
                return;
            var index = itm.datapoint[1];
            if (index == Settings.maxThreadCount)
                return;
            var contained = visibleGraphs.indexOf(index);
            if (contained < 0) {
                visibleGraphs.push(index);
            } else {
                visibleGraphs.splice(contained, 1);
            }
            Statistics.graphMessages();
        });
    };
    Statistics.messageTimestamps = function (tid, offset) {
        if (typeof offset === "undefined") { offset = 0; }
        var thread = Statistics.threads[tid];
        var what = "timestamp,sender";
        if (Settings.downloadMessageBodies)
            what += ",body,attachment_map";
        var query = "select " + what + " from unified_message where thread_id='" + thread.id + "' LIMIT " + Settings.AJAX.messageGetLimit + " OFFSET  " + offset;
        FBfql(query, function (response) {
            console.log(response);
            if (!$.isArray(response)) {
                //error
                $("#msgload").text("Error " + response.error_code + ": " + response.error_msg);
                console.log("Error: ", response);
                return;
            }
            for (var i = 0; i < response.length; i++) {
                var stamp = parseInt(response[i].timestamp, 10);
                if (stamp >= 1072915200000) {
                    thread.messages.push(new Message(stamp, response[i].body, response[i].sender ? new Person(response[i].sender) : undefined, response[i].attachment_map));
                }
            }
            $("#msgload").text("Downloading " + (Settings.downloadMessageBodies ? "message" : "timestamp") + " " + thread.messages.length + " / " + thread.count + " from thread " + tid + " (" + threadName(tid, thread, 20) + ")");
            if (response.length == 0) {
                thread.messages.sort();
                Statistics.lastUpdate = Date.now();
                Statistics.graphMessages();
            } else {
                Statistics.messageTimestamps(tid, offset + response.length);
            }
        });
    };
    Statistics.graphMessages = function () {
        if (visibleGraphs.length > 0)
            $("#rswait").hide();
        var mapped = [];
        var otherMessages = [];

        for (var t = 0; t < Statistics.threads.length; t++) {
            var shown = visibleGraphs.indexOf(t) != -1;
            if (shown)
                Statistics.threadPlot.highlight(0, t);
            else
                Statistics.threadPlot.unhighlight(0, t);
            var thread = Statistics.threads[t];
            if (shown && (!thread.messages || thread.messages.length == 0 || thread.messages.length !== thread.count)) {
                if (thread.messages.length > 0) {
                    console.log("warn: messages for thread " + t + " incomplete, resetting..");
                    thread.messages = [];
                }
                console.log("Downloading thread " + t);
                if ($("#msgload").length == 0) {
                    $("<a/>", {
                        class: "btn btn-lg btn-primary centered",
                        html: "<span id=msgload>Downloading thread</span> <img src=loader.gif>"
                    }).appendTo("#threadtime");
                }
                Statistics.messageTimestamps(t);
                return;
            }
            if (shown) {
                addSeries(threadName(t, thread), t, thread.messages, mapped);
            } else if (Settings.displayOtherMessages) {
                otherMessages = otherMessages.concat(thread.messages);
            }
        }
        if (Settings.displayOtherMessages) {
            otherMessages.sort(function (a, b) {
                return a.timestamp - b.timestamp;
            });
            if (otherMessages.length > 0) {
                addSeries(visibleGraphs.length > 0 ? "Other" : "All", -1, otherMessages, mapped);
            }
        }

        // add missing data
        var first = 1e100;
        var last = 0;
        for (var t = 0; t < mapped.length; t++) {
            var curfirst = mapped[t].data[0][0];
            var curlast = mapped[t].data[mapped[t].data.length - 1][0];
            if (curfirst < first)
                first = curfirst;
            if (curlast > last)
                last = curlast;
        }
        for (var t = 0; t < mapped.length; t++) {
            var arr = mapped[t].data;
            while (arr[0][0] > first) {
                var date = new Date(+arr[0][0]);
                date.addInterval(-1);
                arr.unshift([date.getTime(), 0]);
            }
            while (arr[arr.length - 1][0] < last) {
                var date = new Date(+arr[arr.length - 1][0]);
                date.addInterval(1);
                arr.push([date.getTime(), 0]);
            }
        }

        Statistics.messagePlot = $.plot($("#threadtime"), mapped, {
            xaxis: {
                mode: 'time'
            },
            yaxis: scales[Settings.Graph.scale],
            legend: {
                position: "nw"
            },
            series: {
                shadowSize: 0
            },
            lines: {
                show: true,
                lineWidth: 0,
                fillColor: {
                    colors: [
                        {
                            opacity: (Settings.Graph.stackThreads || Settings.Graph.stackInOut ? 1 : Settings.Graph.unstackedOpacity)
                        }, {
                            opacity: (Settings.Graph.stackThreads || Settings.Graph.stackInOut ? 0.99 : Settings.Graph.unstackedOpacity - 0.01)
                        }]
                },
                fill: true,
                steps: Settings.Graph.steps
            },
            colors: plotcolors
        });
    };
    Statistics.exportToCSV = function () {
        var s = "Thread,From,Date,Message,Attachments\n";
        for (var t = 0; t < Statistics.threads.length; t++) {
            var tt = Statistics.threads[t], n = threadName(t, tt);
            for (var m = 0; m < tt.messages.length; m++) {
                var msg = tt.messages[m];
                s += '"' + [n, msg.from.name, new Date(msg.timestamp).toISOString(), msg.message.replace(/"/g, '""'), JSON.stringify(msg.attachments).replace(/"/g, '""')].join('","') + "\"\n";
            }
        }
        ;
        var a = document.body.appendChild(document.createElement("a"));
        a.href = URL.createObjectURL(new Blob([s], { type: "text/csv" }));
        a.download = "Facebook-Messages.csv";
        a.click();
    };
    Statistics.lastUpdate = 0;
    Statistics.threads = [];
    Statistics.reducedThreads = [];

    Statistics.version = "2";
    return Statistics;
})();
var DefaultSettings = {
    ignoreBelowMessageCount: 20,
    displayOtherMessages: true,
    anonymous: false,
    AJAX: {
        threadGetLimit: 100,
        messageGetLimit: 502
    },
    cacheTime: 60 * 60 * 24,
    maxThreadCount: 20,
    downloadMessageBodies: false,
    Graph: {
        smoothAmount: 0,
        separateInOut: true,
        stackThreads: true,
        stackInOut: true,
        unstackedOpacity: 0.8,
        steps: true,
        scale: "linear",
        grouping: 1 /* weekly */
    }
};
var Settings = DefaultSettings;

function loadSettings() {
    Settings = storageGetObject("settings") || DefaultSettings;
}

function saveSettings() {
    storageSetObject("settings", Settings);
}
/**
* source: https://github.com/phiresky/fbstats
* to be compiled with closure compiler
*/
/// <reference path="inc/jquery.d.ts" />
/// <reference path="inc/fbsdk.d.ts" />
/// <reference path="inc/jquery.flot.d.ts" />
/// <reference path="main.ts" />
/// <reference path="classes.ts" />
/// <reference path="statistics.ts" />
/// <reference path="settings.ts" />
//# sourceMappingURL=fbstats.js.map
