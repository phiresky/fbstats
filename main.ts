/**
 * source: https://github.com/phiresky/fbstats
 */

var user = {
    userID: "unknown"
};

enum TimeGrouping {
    daily, weekly, monthly, END
}

var visibleGraphs: number[] = [];
var plotcolors = ["#942727", "#5DA5DA", "#FAA43A", "#60BD68", "#F17CB0", "#B2912F", "#B276B2", "#DECF3F", "#F15854", "#4D4D4D"];
var BUSY=false;
function getColor(tid: number, isIn: boolean) {
    var color: string;
    if (tid == -1) color = otherColor;
    else color = plotcolors[tid % plotcolors.length];
    return toRGBA(hexToRGB(color, isIn ? 1.0 : 0.8));
}
var otherColor = "#999999";
var scales: { [x: string]: Object } = {
    "linear": {},
    "sqrt": {
        inversetransform: (v: number) => v * v,
        transform: (v: number) => Math.sqrt(v)
    },
    "log": {
        inversetransform: (v: number) => Math.exp(v) - 1,
        transform: (v: number) => Math.log(v + 1)
    }
}

function threadName(t: number, thread: Thread, maxlength: number = 10000): string {
    if (t == -1)
        return "Other";
    if (Settings.anonymous)
        return "Person " + t;
    var str = $.map(thread.people, function(p) {
		return p.name || p.id
	}).join(", ");
    if (str.length > maxlength - 3)
        return str.substring(0, maxlength - 1) + "…";
    return str;
}

function hexToRGB(hex: string, multiply: number): number[] {
    var hexInt = parseInt(hex.substring(1), 16);
    var r = hexInt >> 16;
    var g = hexInt >> 8 & 0xFF;
    var b = hexInt & 0xFF;
    return [r * multiply, g * multiply, b * multiply];
}

function toRGBA(hex: number[], a: number = 1) {
    return "rgba(" + hex.map((x) => (x | 0)).join(",") + "," + a + ")";
}

/**
 * sets all threads as active and gets them
 */
function getAll(max: number = Statistics.threads.length, min: number = 0) {
    if (max===null)
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
    FB.login(function(response: any) {
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
    setTimeout(function() { // delay loading cache
        var loaded = Statistics.load();
        $("<a/>", {
            "class": "btn btn-lg btn-primary centered",
            html: "<span id=threadload>Gathering statistics</span> <img src=loader.gif alt=\"loading..\">",
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
function init(appid: string) {
    Settings.appID=appid;
	if(!FB.getLoginStatus) {
		throw new Error("Facebook API could not be accessed. Make sure Ghostery or similar allows 'Facebook Connect' and 'Facebook Social Graph'.");
	}
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
    FB.getLoginStatus(function(response: { status: string; authResponse: { userID: string } }) {
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
    (<any>$("#threadcount").parent()).resizable();
    (<any>$("#threadtime").parent()).resizable();
}

function checkPerms(): void {
    FB.api("/me/permissions", "get", function(e: any) {
        if (e.data[0].permission === "installed") {// fb api v2.0 
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

function log(e: IArguments): void {
    console.groupCollapsed((<any>e.callee).name);
    for (var i in e)
        console.log(e[i]);
    console.trace();
    console.groupEnd();
}

function mapTimestampsToDays(tid:number, messages: Message[]): number[][] {
    var days: { [index: number]: number } = {};
    if(messages.length==0) {
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
        case TimeGrouping.weekly:
            next.setDate(next.getDate() - next.getDay());
            break;
        case TimeGrouping.monthly:
            next.setDate(1);
            break;
    }
    //
    //set to last sunday
    for (var i = 0; i < messages.length; i++) {
        var messageDate = new Date(messages[i].timestamp);
        if (messageDate.getTime() < next.getTime()) {
            days[current.getTime()] += Settings.countChars?messages[i].message.length||1:1;
        } else {
            current = new Date(next.getTime());
            //TODO: new Date not needed just use timestamp
            days[current.getTime()] = 0;
            next.addInterval(1);
        }
    }
    var dayArray: number[][] = [];
    for (var s = 0; s < Settings.Graph.smoothAmount; s++) {
        var days2: { [index: number]: number } = {};
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

function FBfql(a: string, b: (o: any) => void) {
    log(arguments);
    FB.api({
        method: 'fql.query',
        query: a
    }, b);
}
declare var LZString: { compressToUTF16(a: string): string; decompressFromUTF16(a: string): string; }
function storageSetObject(key: string, value: {}) {
    localStorage.setItem(key, LZString.compressToUTF16(JSON.stringify(value)));
}

function storageGetObject(key: string) {
    var value = localStorage.getItem(key);
    return value && JSON.parse(LZString.decompressFromUTF16(value));
}


function addSeries(label: string, threadID: number, messages: Message[], mapped: { label: string; data: number[][] }[]) {
    if (Settings.Graph.separateInOut) {
        var dataIn=mapTimestampsToDays(threadID, messages.filter((m) => m.from.id !== user.userID));
        var dataOut=mapTimestampsToDays(threadID, messages.filter((m) => m.from.id === user.userID))
        if(dataIn!==null) mapped.push({
            label: label + "|In",
            stack: (Settings.Graph.stackThreads ? 1 : threadID)+(Settings.Graph.stackInOut ? 0 : 1e9),
            color: getColor(threadID, true),
            data: dataIn
        });
        if(dataOut!==null) mapped.push({
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

interface Date {
    getWeek(): number;
    addInterval(i: number): void;
}
Date.prototype.getWeek = function() {
    var onejan = new Date(this.getFullYear(), 0, 1);
    return Math.ceil((((this.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
}
Date.prototype.addInterval = function(i: number) {
    switch (Settings.Graph.grouping) {
        case TimeGrouping.monthly:
            this.setMonth(this.getMonth() + i); break;
        case TimeGrouping.weekly:
            this.setDate(this.getDate() + 7 * i); break;
        case TimeGrouping.daily:
            this.setDate(this.getDate() + i); break;
    }
}
$(function() {
    loadSettings();
    var butt = $("#loginbutton");
    var txt = $("#logintext");
    var img = butt.children("img");
    $("#appidinput").val(Settings.appID);
    butt.hide();
    $("#appidform").submit(function() {
        $(".fbstats-bool").each(function() {
            this.checked = eval(this.dataset.setting);
            this.disabled = !Settings.downloadMessageBodies && SettingNeedsDownloadMessages.indexOf(this.dataset.setting)>=0;
        });
        try {
            event.preventDefault();
            init($("#appidinput").val());
            $("#settings").show();
            $(this).hide();
        } catch (e) {
            $(".errormessage").append(e).fadeIn(); throw e;
        }
    });
    var scaleselect = $("#scaleselect").change(function() {
        Settings.Graph.scale = $(this).val();
        Statistics.graphThreads();
        Statistics.graphMessages();
    });
    for (var s in scales) {
        $("<option/>").text(s).appendTo(scaleselect);
    }

    $(".fbstats-bool").on("change", function() {
        var setting = this.dataset.setting;
        if (eval(setting) === undefined && eval("Default"+setting)===undefined) throw new Error("unknown setting " + setting);
        eval(setting + '=' + this.checked);
        if (this.dataset.norefresh === undefined) {
            if (this.dataset.redrawThreads !== undefined) Statistics.graphThreads();
            Statistics.graphMessages();
        }
    }).each(function() {
		this.checked = eval(this.dataset.setting);
		this.disabled = !Settings.downloadMessageBodies && SettingNeedsDownloadMessages.indexOf(this.dataset.setting)>=0;
	});


    $("#groupingselect").change(function() {
        Settings.Graph.grouping = +TimeGrouping[this.value];
        Statistics.graphThreads();
        Statistics.graphMessages();
    });

    $("#threadcountinput").change(function() {
        var c = $(this).val() || 15;
        if (c < 3) c = 3;
        if (c > 50) c = 50;
        $(this).val(c);
        Settings.maxThreadCount = c;
        Statistics.graphThreads();
    })

	$(window).on("beforeunload", function() {
	    saveSettings();
        if (Statistics.lastUpdate && Statistics.threads.length > 0)
            Statistics.save();
    });
});

//} catch(e) {$(".errormessage").append(e).fadeIn();throw e;}
