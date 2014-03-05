/**
 * @author github.com/tehdog
 * to be compiled with closure compiler
 */
var user;
var threadGetLimit = 100,
    msgGetLimit = 502;
var cacheTime = 60 * 60 * 24;
var smooth = 0; //smooth time graphs
var stacked = true;
var steps = true;
var visibleGraphs = [];
var anonymous = false;
var plotcolors = ["#942727", "#5DA5DA", "#FAA43A", "#60BD68", "#F17CB0", "#B2912F", "#B276B2", "#DECF3F", "#F15854", "#4D4D4D"];

/** @constructor */
function Person(inputobj) {
    this.id = inputobj.user_id || 0;
    this.name = (typeof inputobj.name == "undefined") ? "Andere" : inputobj.name;
}

/** @constructor 
 * @param {*} inputobj 
 */
function Thread(inputobj) {
    this.count = parseInt(inputobj.num_messages || 0, 10);
    this.people = [];
    this.messages = [];
    this.id = inputobj.thread_id;
    for (var i = 0; i < inputobj.participants.length; i++) {
        var p = new Person(inputobj.participants[i]);
        if (p.id == user.userID) continue;
        this.people.push(p);
    }
}

/** 
 * @param {number} t thread id
 * @param {Thread} thread thread object
 * @return {string} 
 */
function threadName(t, thread) {
    if (t == Statistics.maxThreadCount) return "Other";
    if (anonymous) return "Person " + t;
    return $.map(thread.people, function (p) {
        return p.name || p.id
    }).join(", ").substring(0, 50);
}

function hexToRGBA(hex, a) {
    hex = parseInt(hex.substring(1), 16);
    var r = hex >> 16;
    var g = hex >> 8 & 0xFF;
    var b = hex & 0xFF;
    return "rgba(" + [r, g, b, a].join(",") + ")";
}

/**
 * sets all threads as active and gets them
 * @param {number} max
 */
function getAll(max) {
    if (!max) max = Statistics.threads.length;
    visibleGraphs = [];
    for (var i = 0; i < max; i++) visibleGraphs.push(i);
    Statistics.graphMessages();
}

/**
 * add all small threads to the last visible thread and redraw
 */
function pushOther() {
    for (var i = Statistics.maxThreadCount + 1; i < Statistics.threads.length; i++) Statistics.threads[Statistics.maxThreadCount].messages = Statistics.threads[Statistics.maxThreadCount].messages.concat(Statistics.threads[i].messages);
    Statistics.threads[Statistics.maxThreadCount].messages.sort(function (a, b) {
        return a - b
    });
    getAll(Statistics.maxThreadCount + 1);
}

function login() {
	FB.login(function (response) {
		document.location.reload();
	}, {
		scope: 'read_mailbox'
	});
}

function start() {
	//txt.text("Gathering statistics");
	$("<a/>", {
		class: "btn btn-lg btn-primary centered",
		html: "<span id=threadload>Gathering statistics</span> <img src=loader.gif alt=\"loading..\">",
	}).appendTo("#threadcount");

	$("<a/>", {
		class: "btn btn-lg btn-primary centered",
		html: "Select a person on the left",
	}).appendTo("#threadtime");

	if (Statistics.load()) {
		Statistics.graphThreads();
	} else {
		Statistics.countThreads();
	}
	$("#loginbutton").fadeOut();
	//butt.hide();
}

/**
 * @param {string} appid
 */
function init(appid) {

	var butt=$("#loginbutton");
	var txt = $("#logintext");
	var img=butt.children("img");
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
			FB.api("/me/permissions", function (e) {
				if (!e.data[0].read_mailbox) {
					txt.text("Could not access message data");
					img.hide();
				} else {
					user = response.authResponse;
					start();
				}
			});
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



function log(e) {
    console.groupCollapsed(e.callee.name);
    for (var i in e) console.log(e[i]);
    console.trace();
    console.groupEnd();
}

FB.apireal = FB.api;
FB.api = function FBapi(a, b) {
    log(arguments);
    FB.apireal(a, localStorage.getObject("fb_info") || {}, b);
}
FB.fql = function (a, b) {
    log(arguments);
    FB.apireal($.extend({
        method: 'fql.query',
        query: a
    }, localStorage.getObject("fb_info") || {}), b);
}

Storage.prototype.setObject = function (key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function (key) {
    var value = this.getItem(key);
    return value && JSON.parse(value);
}

var Statistics = {
    maxThreadCount: 20,
    threads: [],
    reducedThreads: [],
    save: function () {
        localStorage.setItem("lastUpdate", Statistics.lastUpdate);
        if (Statistics.lastUpdate == 0) Statistics.threads = [];
        localStorage.setObject("threads", Statistics.threads);
    },
    load: function () {
        var last = localStorage.getItem("lastUpdate");
        if (!last || (Date.now() - parseInt(last,10) > 1000 * cacheTime))
            return false; //could not load/cache too old 
        Statistics.threads = localStorage.getObject("threads");
        return true;
    },
    countThreads: function (offset) {
        offset = offset || 0;
        var query = "select participants,num_messages,thread_id from unified_thread where folder='inbox' LIMIT " + threadGetLimit + " OFFSET " + offset;
        FB.fql(query,
            function (response) {
                if (!$.isArray(response)) {
                    //error
                    $("#threadload").text("Error " + response.error_code + ": " + response.error_msg);
                    console.log("Error: ", response);
                    return;
                }
                //log(arguments);
                for (var i = 0; i < response.length; i++) {
                    Statistics.threads.push(new Thread(response[i]));
                }
                $("#threadload").text("Getting thread " + Statistics.threads.length);
                if (response.length == 0) { //<threadGetLimit) {
                    Statistics.threads.sort(function (a, b) {
                        return b.count - a.count
                    });
                    Statistics.lastUpdate = Date.now();
                    Statistics.graphThreads();
                } else {
                    Statistics.countThreads(offset + response.length);
                }
            }
        );
    },
    graphThreads: function () {
        Statistics.reducedThreads = [];
        var other = new Thread({
            participants: [new Person({
                user_id: 0,
                name: "Other"
            })]
        });
        for (var i = 0; i < Statistics.threads.length; i++) {
            if (i >= Statistics.maxThreadCount)
                other.count += Statistics.threads[i].count;
            else Statistics.reducedThreads.push(Statistics.threads[i]);
        }
        Statistics.reducedThreads[Statistics.maxThreadCount] = other;
        var threadGraph = $.plot("#threadcount", [$.map(Statistics.reducedThreads,
            function (t, i) {
                return [[t.count, threadName(i, t)]]
            }
        )], {
            series: {
                bars: {
                    show: true,
                    align: "center",
                    barWidth: 0.6,
                    horizontal: true
                }
            },
            grid: {
                hoverable: true,
                clickable: true,
            },
            yaxis: {
                mode: "categories",
                transform: function (a) {
                    return -a
                },
                inverseTransform: function (a) {
                    return -a
                }
            },
            xaxis: {
                position: "top",
                //transform:function(v){return Math.sqrt(v);}
            }
        });
        $("#threadcount").unbind("plotclick");
        $("#threadcount").bind("plotclick", function (evt, pos, itm) {
            if (!itm) return;
            var index = itm.datapoint[1];
            if (index == Statistics.maxThreadCount) return;
            var contained = visibleGraphs.indexOf(index);
            if (contained < 0) {
                visibleGraphs.push(index);
            } else {
                visibleGraphs.splice(contained, 1);
            }
            Statistics.graphMessages();
        });
    },
    messageTimestamps: function (tid, offset) {
        offset = offset || 0;
        var thread = Statistics.threads[tid];
        console.log("downloading timestamps from thread " + tid + " with offset " + offset);
        var query = "select timestamp from unified_message where thread_id='" + thread.id + "' LIMIT " + msgGetLimit + " OFFSET  " + offset;
        FB.fql(query,
            function (response) {
                if (!$.isArray(response)) {
                    //error
                    $("#msgload").text("Error " + response.error_code + ": " + response.error_msg);
                    console.log("Error: ", response);
                    return;
                }
                for (var i = 0; i < response.length; i++) {
                    var stamp = parseInt(response[i].timestamp,10);
                    if (stamp >= 1072915200000) // from before 2004 is probably invalid data
                        thread.messages.push(stamp);
                }
                $("#msgload").text("Downloading timestamp " + thread.messages.length + " / " + thread.count);
                if (response.length == 0) {
                    thread.messages.sort();
                    Statistics.lastUpdate = Date.now();
                    Statistics.graphMessages(thread);
                } else {
                    Statistics.messageTimestamps(tid, offset + response.length);
                }
            }
        );
    },
    graphMessages: function () {
        var mapped = [];
        for (var t = 0; t < visibleGraphs.length; t++) {
            var threadid = visibleGraphs[t];
            var thread = Statistics.threads[threadid];
            if (!thread.messages || thread.messages.length == 0) {
                console.log("error: messages not downloaded for thread " + visibleGraphs[t] + ", downloading..");
                $("<a/>", {
                    class: "btn btn-lg btn-primary centered",
                    html: "<span id=msgload>Downloading thread</span> <img src=loader.gif>"
                }).appendTo("#threadtime");
                Statistics.messageTimestamps(visibleGraphs[t]);
                return;
            }
            var days = {};
            var current = new Date(0);
            var next = new Date(thread.messages[0]);
            next.setHours(0);
            next.setMinutes(0);
            next.setSeconds(0);
            next.setMilliseconds(0);
            next.setDate(next.getDate() - next.getDay()); //set to last sunday
            for (var i = 0; i < thread.messages.length; i++) {
                var messageDate = new Date(thread.messages[i]);
                if (messageDate.getTime() < next.getTime()) {
                    days[current.getTime()]++;
                } else {
                    current = new Date(next); //TODO: new Date not needed just use timestamp
                    days[current.getTime()] = 0;
                    next.setDate(next.getDate() + 7);
                }
            }
            var dayArray = [];
            for (var s = 0; s < smooth; s++) {
                var days2 = {};
                var a = 0,
                    b = 0,
                    c = 0;
                for (var day in days) {
                    c = b;
                    b = a;
                    a = day;
                    if (b == 0) continue;
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
            mapped.push({
                label: threadName(threadid, thread),
                data: dayArray
            });
        }
        // add missing data
        var first = 1e100;
        var last = 0;
        for (var t = 0; t < mapped.length; t++) {
            var curfirst = mapped[t].data[0][0];
            var curlast = mapped[t].data[mapped[t].data.length - 1][0];
            if (curfirst < first) first = curfirst;
            if (curlast > last) last = curlast;
        }
        for (var t = 0; t < mapped.length; t++) {
            var arr = mapped[t].data;
            while (arr[0][0] > first) {
                arr.unshift([parseInt(arr[0][0],10) - 7 * 24 * 60 * 50 * 1000, 0]);
            }
            while (arr[arr.length - 1][0] < last) {
                arr.push([parseInt(arr[arr.length - 1][0],10) + 7 * 24 * 60 * 50 * 1000, 0]);
            }
        }

        $("#threadtime").plot(mapped, {
            xaxis: {
                mode: 'time'
            },
            yaxis: {
                inversetransform: function (v) {
                    return v * v;
                },
                transform: function (v) {
                    return Math.sqrt(v);
                }
            },
            legend: {
                position: "nw"
            },
            series: {
                stack: stacked,
                shadowSize: 0
            },
            lines: {
                show: true,
                lineWidth: 0,
                fillColor: {
                    colors: [{
                        opacity: (stacked ? 1 : 0.65)
                    }, {
                        opacity: (stacked ? 0.99 : 0.64)
                    }]
                },
                fill: true,
                steps: steps
            },
            colors: plotcolors
        });
    },
    exportToCSV: function () {
        var s = "";
        for (var t = 0; t < Statistics.threads.length; t++) {
            var tt = Statistics.threads[t],
                n = threadName(t, tt);
            for (var m = 0; m < tt.messages.length; m++)
                s += [n, new Date(tt.messages[m]).toISOString()].join(";") + "\n"
        };
        window.open().document.body.innerText = s;
    }
}
Date.prototype.getWeek = function () {
    var onejan = new Date(this.getFullYear(), 0, 1);
    return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}


$(function (){
	var butt = $("#loginbutton");
	var txt = $("#logintext");
	var img = butt.children("img");
	butt.hide();
	$("#appidform").submit(function () {
		event.preventDefault();
		init($("#appidinput").val());
		$(this).hide();
	});

	$(window).on("beforeunload", function () {
		if (Statistics.lastUpdate && Statistics.threads.length > 0)
			Statistics.save();
	});
});

