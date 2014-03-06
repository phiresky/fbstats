/**
 * @author github.com/tehdog
 * to be compiled with closure compiler
 */

var user = {
	userID : "unknown"
};
MIN_THREAD_MSG_COUNT = 20;
// ignore conversations with less than this messages
var other = true;
var threadGetLimit = 100, msgGetLimit = 502;
var cacheTime = 60 * 60 * 24;
var smooth = 0;
//smooth time graphs
var stacked = true;
var steps = true;
var visibleGraphs = [];
var anonymous = false;
var grouping = "weekly";
var plotcolors = ["#942727", "#5DA5DA", "#FAA43A", "#60BD68", "#F17CB0", "#B2912F", "#B276B2", "#DECF3F", "#F15854", "#4D4D4D"];
var scales = {
	"linear" : {},
	"sqrt" : {
		inversetransform : function(v) {
			return v * v;
		},
		transform : function(v) {
			return Math.sqrt(v);
		}
	},
	"log" : {
		inversetransform : function(v) {
			return Math.exp(v) - 1;
		},
		transform : function(v) {
			return Math.log(v + 1);
		}
	}
}
var scale = scales["linear"];
/** @constructor */
function Person(inputobj) {
	this.id = inputobj.user_id || 0;
	this.name = ( typeof inputobj.name == "undefined") ? "Andere" : inputobj.name;
}

/** @constructor
 * @param {{num_messages:number,thread_id:number,participants:Array.<*>}} inputobj
 */
function Thread(inputobj) {
	this.count = parseInt(inputobj.num_messages || 0, 10);
	this.people = [];
	this.messages = [];
	this.id = inputobj.thread_id;
	for (var i = 0; i < inputobj.participants.length; i++) {
		var p = new Person(inputobj.participants[i]);
		if (p.id == user.userID)
			continue;
		this.people.push(p);
	}
}

/**
 * @param {number} t thread id
 * @param {Thread} thread thread object
 * @param {number?} maxlength
 * @return {string}
 */
function threadName(t, thread, maxlength) {
	if (!maxlength)
		maxlength = 50;
	if (t == -1)
		return "Other";
	if (anonymous)
		return "Person " + t;
	var str = $.map(thread.people, function(p) {
		return p.name || p.id
	}).join(", ");
	if (str.length > maxlength - 3)
		return str.substring(0, maxlength - 1) + "…";
	return str;
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
function getAll(max, min) {
	if (!min)
		min = 0;
	if (!max)
		max = Statistics.threads.length;
	visibleGraphs = [];
	for (var i = min; i < max; i++)
		visibleGraphs.push(i);
	Statistics.graphMessages();
}

function getAllVisible() {
	getAll(Statistics.maxThreadCount);
}

function getAllInvisible() {
	getAll(null, Statistics.maxThreadCount);
}

function login() {
	FB.login(function(response) {
		if(response.authResponse) {
			user = response.authResponse;
			checkPerms();
		} else {
			document.location.reload();
		}
	}, {
		scope : 'read_mailbox'
	});
}

function start() {
	//txt.text("Gathering statistics");
	$("<a/>", {
		class : "btn btn-lg btn-primary centered",
		html : "<span id=threadload>Gathering statistics</span> <img src=loader.gif alt=\"loading..\">",
	}).appendTo("#threadcount");

	$("<a/>", {
		class : "btn btn-lg btn-primary centered",
		html : "Select a person on the left",
		id : "rswait"
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

	var butt = $("#loginbutton");
	var txt = $("#logintext");
	var img = butt.children("img");
	butt.show();
	txt.text("Logging in to Facebook");
	FB.init({
		appId : appid,
		xfbml : false,
		cookie : true
	});
	FB.getLoginStatus(function(response) {
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
	FB.api("/me/permissions", function(e) {
		if (!e.data[0].read_mailbox) {
			txt.text("Could not access message data");
			img.hide();
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

function mapTimestampsToDays(messages) {
	var days = {};
	var current = new Date(0);
	var next = new Date(messages[0]);
	next.setHours(0);
	next.setMinutes(0);
	next.setSeconds(0);
	next.setMilliseconds(0);
	switch(grouping) {
		case "weekly":
			next.setDate(next.getDate() - next.getDay());
			break;
		case "monthly":
			next.setDate(1);
			break;
	}
	//
	//set to last sunday
	for (var i = 0; i < messages.length; i++) {
		var messageDate = new Date(messages[i]);
		if (messageDate.getTime() < next.getTime()) {
			days[current.getTime()]++;
		} else {
			current = new Date(next);
			//TODO: new Date not needed just use timestamp
			days[current.getTime()] = 0;
			next.addInterval(1);
		}
	}
	var dayArray = [];
	for (var s = 0; s < smooth; s++) {
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

FB.fql = function(a, b) {
	log(arguments);
	FB.api({
		method : 'fql.query',
		query : a
	}, b);
}

Storage.prototype.setObject = function(key, value) {
	this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
	var value = this.getItem(key);
	return value && JSON.parse(value);
}
var Statistics = {
	maxThreadCount : 20,
	threads : [],
	reducedThreads : [],
	save : function() {
		localStorage.setItem("lastUpdate", Statistics.lastUpdate);
		if (Statistics.lastUpdate == 0)
			Statistics.threads = [];
		localStorage.setObject("threads", Statistics.threads);
	},
	load : function() {
		var last = localStorage.getItem("lastUpdate");
		if (!last || (Date.now() - parseInt(last, 10) > 1000 * cacheTime))
			return false;
		//could not load/cache too old
		Statistics.threads = localStorage.getObject("threads");
		return true;
	},
	countThreads : function(offset) {
		offset = offset || 0;
		var query = "select participants,num_messages,thread_id from unified_thread where folder='inbox' LIMIT " + threadGetLimit + " OFFSET " + offset;
		FB.fql(query, function(response) {
			if (!$.isArray(response)) {
				//error
				$("#threadload").text("Error " + response.error_code + ": " + response.error_msg);
				console.log("Error: ", response);
				return;
			}
			//log(arguments);
			for (var i = 0; i < response.length; i++) {
				//console.log(response[i]);
				if (response[i].num_messages < MIN_THREAD_MSG_COUNT)
					continue;
				Statistics.threads.push(new Thread(response[i]));
			}
			$("#threadload").text("Getting thread " + Statistics.threads.length);
			if (response.length == 0) {//<threadGetLimit) {
				Statistics.threads.sort(function(a, b) {
					return b.count - a.count
				});
				Statistics.lastUpdate = Date.now();
				Statistics.graphThreads();
			} else {
				Statistics.countThreads(offset + response.length);
			}
		});
	},
	graphThreads : function() {
		Statistics.reducedThreads = [];
		var otherCount = 0;
		for (var i = 0; i < Statistics.threads.length; i++) {
			if (i >= Statistics.maxThreadCount)
				otherCount += Statistics.threads[i].count;
			else
				Statistics.reducedThreads.push(Statistics.threads[i]);
		}
		var data = [$.map(Statistics.reducedThreads, function(t, i) {
			return [[t.count, threadName(i, t)]]
		})];
		data[0].push([otherCount, "Other"]);
		//window.dat2a=data;
		var threadGraph = $.plot("#threadcount", data, {
			series : {
				bars : {
					show : true,
					align : "center",
					barWidth : 0.6,
					horizontal : true
				}
			},
			grid : {
				hoverable : true,
				clickable : true,
			},
			yaxis : {
				mode : "categories",
				transform : function(a) {
					return -a
				},
				inverseTransform : function(a) {
					return -a
				}
			},
			xaxis : {
				position : "top",
				//transform:function(v){return Math.sqrt(v);}
			}
		});
		$("#threadcount").unbind("plotclick");
		$("#threadcount").bind("plotclick", function(evt, pos, itm) {
			if (!itm)
				return;
			var index = itm.datapoint[1];
			if (index == Statistics.maxThreadCount)
				return;
			var contained = visibleGraphs.indexOf(index);
			if (contained < 0) {
				visibleGraphs.push(index);
			} else {
				visibleGraphs.splice(contained, 1);
			}
			Statistics.graphMessages();
		});
	},
	messageTimestamps : function(tid, offset) {
		offset = offset || 0;
		var thread = Statistics.threads[tid];
		var query = "select timestamp from unified_message where thread_id='" + thread.id + "' LIMIT " + msgGetLimit + " OFFSET  " + offset;
		FB.fql(query, function(response) {
			if (!$.isArray(response)) {
				//error
				$("#msgload").text("Error " + response.error_code + ": " + response.error_msg);
				console.log("Error: ", response);
				return;
			}
			for (var i = 0; i < response.length; i++) {
				var stamp = parseInt(response[i].timestamp, 10);
				if (stamp >= 1072915200000)// from before 2004 is probably invalid data
					thread.messages.push(stamp);
			}
			$("#msgload").text("Downloading timestamp " + thread.messages.length + " / " + thread.count + " from thread " + tid + " (" + threadName(tid, thread, 20) + ")");
			if (response.length == 0) {
				thread.messages.sort();
				Statistics.lastUpdate = Date.now();
				Statistics.graphMessages(thread);
			} else {
				Statistics.messageTimestamps(tid, offset + response.length);
			}
		});
	},
	graphMessages : function() {
		if (visibleGraphs.length > 0)
			$("#rswait").hide();
		var mapped = [];
		var otherMessages = [];

		for (var t = 0; t < Statistics.threads.length; t++) {
			var shown = visibleGraphs.indexOf(t) != -1;
			var thread = Statistics.threads[t];
			if (shown && (!thread.messages || thread.messages.length == 0)) {
				console.log("warn: messages not downloaded for thread " + t + ", downloading..");
				if ($("#msgload").length == 0) {
					$("<a/>", {
						class : "btn btn-lg btn-primary centered",
						html : "<span id=msgload>Downloading thread</span> <img src=loader.gif>"
					}).appendTo("#threadtime");
				}
				Statistics.messageTimestamps(t);
				return;
			}
			if (shown) {
				mapped.push({
					label : threadName(t, thread),
					data : mapTimestampsToDays(thread.messages)
				});
			} else if (other) {
				otherMessages = otherMessages.concat(thread.messages);
			}
		}
		if (other) {
			otherMessages.sort(function(a, b) {
				return a - b;
			});
			if (otherMessages.length > 0) {
				mapped.push({
					label : "Other",
					data : mapTimestampsToDays(otherMessages)
				});
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
				var date = new Date(parseInt(arr[0][0], 10));
				date.addInterval(-1);
				arr.unshift([date.getTime(), 0]);
			}
			while (arr[arr.length - 1][0] < last) {
				var date = new Date(parseInt(arr[arr.length - 1][0], 10));
				date.addInterval(1);
				arr.push([date.getTime(), 0]);
			}
		}

		$("#threadtime").plot(mapped, {
			xaxis : {
				mode : 'time'
			},
			yaxis : scale,
			legend : {
				position : "nw"
			},
			series : {
				stack : stacked,
				shadowSize : 0
			},
			lines : {
				show : true,
				lineWidth : 0,
				fillColor : {
					colors : [{
						opacity : ( stacked ? 1 : 0.65)
					}, {
						opacity : ( stacked ? 0.99 : 0.64)
					}]
				},
				fill : true,
				steps : steps
			},
			colors : plotcolors
		});
	},
	exportToCSV : function() {
		var s = "";
		for (var t = 0; t < Statistics.threads.length; t++) {
			var tt = Statistics.threads[t], n = threadName(t, tt);
			for (var m = 0; m < tt.messages.length; m++)
				s += [n, new Date(tt.messages[m]).toISOString()].join(";") + "\n"
		};
		window.open().document.body.innerText = s;
	}
}
Date.prototype.getWeek = function() {
	var onejan = new Date(this.getFullYear(), 0, 1);
	return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}
Date.prototype.addInterval = function(i) {
	if (grouping == "monthly") {
		this.setMonth(this.getMonth() + i);
	} else if (grouping == "weekly") {
		this.setDate(this.getDate() + 7*i);
	} else {
		this.setDate(this.getDate() + i);
	}
}
$(function() {
	var butt = $("#loginbutton");
	var txt = $("#logintext");
	var img = butt.children("img");
	butt.hide();
	$("#appidform").submit(function() {
		event.preventDefault();
		init($("#appidinput").val());
		$(this).hide();
	});
	var scaleselect = $("#scaleselect").change(function() {
		scale = scales[$(this).val()];
		Statistics.graphThreads();
		Statistics.graphMessages();
	});
	for (var s in scales) {
		$("<option/>").text(s).appendTo(scaleselect);
	}
	
	$("#groupingselect").change(function() {
		grouping=$(this).val();
		Statistics.graphThreads();
		Statistics.graphMessages();
	});
	
	$("#threadcountinput").change(function() {
		var c = $(this).val()||15;
		if(c<3) c=3;
		if(c>50) c = 50;
		$(this).val(c);
		Statistics.maxThreadCount=c;
		Statistics.graphThreads();
	})

	$(window).on("beforeunload", function() {
		if (Statistics.lastUpdate && Statistics.threads.length > 0)
			Statistics.save();
	});
});

