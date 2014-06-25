class Statistics {
    static lastUpdate = 0;
    static threads: Thread[] = [];
    static reducedThreads: Thread[] = [];
    static threadPlot: jquery.flot.plot;
    static messagePlot: jquery.flot.plot;
    static version = "2";
    static save() {
		console.info("saving to localStorage");
        localStorage.setItem("lastUpdate", "" + Statistics.lastUpdate);
        localStorage.setItem("fbstatsversion", Statistics.version);
        if (Statistics.lastUpdate == 0)
            Statistics.threads = [];
        storageSetObject("threads", Statistics.threads);
    }
    static load() {
        var last = localStorage.getItem("lastUpdate");
        var savedversion = localStorage.getItem("fbstatsversion");
        if (savedversion !== Statistics.version || !last || (Date.now() - parseInt(last, 10) > 1000 * Settings.cacheTime))
            return false;
		console.info("loading from localStorage");
        //could not load/cache too old
        Statistics.threads = storageGetObject("threads")||[];
		if(!Statistics.threads||Statistics.threads.length==0) return false;
        return true;
    }
    static countThreads(offset: number = 0) {
        var query = "select participants,num_messages,thread_id from unified_thread where folder='inbox' LIMIT " + Settings.AJAX.threadGetLimit + " OFFSET " + offset;
        FBfql(query, function(response) {
            if (!$.isArray(response)) {
                //error
                $("#threadload").text("Error " + response.error_code + ": " + response.error_msg);
                console.log("Error: ", response);
                return;
            }
            //log(arguments);
            for (var i = 0; i < response.length; i++) {
                //console.log(response[i]);
                if (response[i].num_messages < Settings.ignoreBelowMessageCount)
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
    }
    static graphThreads() {
        Statistics.reducedThreads = [];
        var otherCount = 0;
        for (var i = 0; i < Statistics.threads.length; i++) {
            if (i >= Settings.maxThreadCount)
                otherCount += Statistics.threads[i].count;
            else
                Statistics.reducedThreads.push(Statistics.threads[i]);
        }
        var data: any = [$.map(Statistics.reducedThreads, function(t, i) {
			return [[t.count, threadName(i, t)]]
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
                    color:toRGBA(hexToRGB("#ffc508",1),0.8),
                    fillColor:toRGBA(hexToRGB("#ffc508",1),0.5)
                },
                highlightColor:toRGBA(hexToRGB("#00bd10",1),0.5)
            },
            grid: {
                hoverable: true,
                clickable: true,
                autoHighlight: false
            },
            yaxis: {
                mode: "categories",
                transform: function(a) {
					return -a
				},
                inverseTransform: function(a) {
					return -a
				}
            },
            xaxis: jQuery.extend({
                position: "top",
            }, scales[Settings.Graph.scale]),
        });
        $("#threadcount")
        .off("plotclick")
        .off("plothover")
        .on("plothover", function(evt: any, pos: number, itm: any) {
            if (!itm) document.body.style.cursor = 'default';
            else if(itm.datapoint[1]<Settings.maxThreadCount) document.body.style.cursor = 'pointer';
            
        })
        .on("plotclick", function(evt: any, pos: number, itm: any) {
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
    }
    static messageTimestamps(tid: number, offset = 0) {
        var thread = Statistics.threads[tid];
        var what = "timestamp,sender";
        if (Settings.downloadMessageBodies)
            what += ",body,attachment_map";
        var query = "select " + what + " from unified_message where thread_id='" + thread.id + "' LIMIT " + Settings.AJAX.messageGetLimit + " OFFSET  " + offset;
        FBfql(query, function(response) {
            if (!$.isArray(response)) {
                //error
                $("#msgload").text("Error " + response.error_code + ": " + response.error_msg);
                console.log("Error: ", response);
                return;
            }
            for (var i = 0; i < response.length; i++) {
                var stamp = parseInt(response[i].timestamp, 10);
                if (stamp >= 1072915200000) {// from before 2004 is probably invalid data
                    thread.messages.push(new Message(stamp, response[i].body, response[i].sender ? new Person(response[i].sender) : undefined, response[i].attachment_map));
                }
            }
            $("#msgload").text("Downloading " + (Settings.downloadMessageBodies ? "message" : "timestamp") + " " + thread.messages.length + " / " + thread.count + " from thread " + tid + " (" + threadName(tid, thread, 20) + ")");
            if (response.length == 0) {
                thread.messages.sort((a,b)=>a.timestamp-b.timestamp);
                Statistics.lastUpdate = Date.now();
				if(thread.messages.length>1000) Statistics.save(); // save if just downloaded lots of messages
                BUSY=false;
                Statistics.graphMessages();
            } else {
                Statistics.messageTimestamps(tid, offset + response.length);
            }
        });
    }
    static graphMessages() {
        if(BUSY) {$(".errormessage").fadeIn().delay(1000).fadeOut();$(".errormessage>span").text("Busy."); return;}
        BUSY=true;
        if (visibleGraphs.length > 0)
            $("#rswait").hide();
        var mapped: { label: string; data: number[][] }[] = [];
        var otherMessages: Message[] = [];

        for (var t = 0; t < Statistics.threads.length; t++) {
            var shown = visibleGraphs.indexOf(t) != -1;
            if(shown) Statistics.threadPlot.highlight(0,t);
            else Statistics.threadPlot.unhighlight(0,t);
            var thread = Statistics.threads[t];
            if (shown && (!thread.messages || thread.messages.length == 0 || thread.messages.length < thread.count)) {
                if(thread.messages.length>0) {
                    console.log("warn: messages for thread " + t + " incomplete. Got "+thread.messages.length+" messages, expected "+thread.count+", resetting..");
                    thread.messages=[];
                }
                console.log("Downloading thread "+t);
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
            otherMessages.sort((a, b)=> a.timestamp - b.timestamp);
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
                    colors: [{
                        opacity: (Settings.Graph.stackThreads||Settings.Graph.stackInOut ? 1 : Settings.Graph.unstackedOpacity)
                    }, {
                            opacity: (Settings.Graph.stackThreads||Settings.Graph.stackInOut ? 0.99 : Settings.Graph.unstackedOpacity-0.01)
                        }]
                },
                fill: true,
                steps: Settings.Graph.steps
            },
            colors: plotcolors
        });
        BUSY=false;
    }
    static exportToCSV() {
        var s = "Thread,From,Date,Message,Attachments\n";
        for (var t = 0; t < Statistics.threads.length; t++) {
            var tt = Statistics.threads[t], n = threadName(t, tt);
            for (var m = 0; m < tt.messages.length; m++) {
                var msg = tt.messages[m];
                s += '"' + [n, msg.from.name, new Date(msg.timestamp).toISOString(), msg.message.replace(/"/g, '""'), JSON.stringify(msg.attachments).replace(/"/g, '""')].join('","') + "\"\n";
            }
        };
        var a = <HTMLAnchorElement>document.body.appendChild(document.createElement("a"));
        a.href = URL.createObjectURL(new Blob([s], { type: "text/csv" }));
        (<any>a).download = "Facebook-Messages.csv";
        a.click();
    }
}
