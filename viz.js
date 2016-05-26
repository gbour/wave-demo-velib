
var mymap;
var mqcli;
var stations = [];

// http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
}

function map_init() {
	zoom = 13
    mymap = L.map('mapid').setView([48.845965604118284, 2.3487567901611324], zoom);

	L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
		maxZoom: 18,
		id: 'gbour.061k6aba',
		accessToken: 'pk.eyJ1IjoiZ2JvdXIiLCJhIjoiY2lvZWJiaW1uMDAyMXZwajc4MG5hYmRrbiJ9.UUH7qWW7D14p9IrqJ3CiJQ'
	}).addTo(mymap);
};

var uuid;
function mqtt_init() {
    mqcli = mqtt.connect('ws://iot.bour.cc:1884/');
    mqcli.on('connect', function() {
         mqcli.subscribe('/bicycles/#');

		 uuid = createUUID().replace(/-/g,'/'); // ie: "04dfe99f/7a7c/4cd0/815d/5d2403fb1e4c"
		 mqcli.subscribe(uuid);
         mqcli.publish('/bicycles/getstations', JSON.stringify({'city':'paris', 'topic': uuid}));
    });

    mqcli.on('message', function(topic, msg) {
		msg = msg.toString();
        //console.log('message: ', topic, ' -> ', message.toString());
        if( topic == uuid) {
			//mqcli.unsubscribe(uuid);
			add_station(JSON.parse(msg));
			return;	
		}
		
		//console.log(topic + ':'+msg);
		if( topic.startsWith('/bicycles/paris') ) {
			var id    = topic.split('/')[3];
			var field = topic.split('/')[4];

			update_station(id, field, JSON.parse(msg));
		}
    });
};

function add_station(desc) {
	if (desc.number in stations) { return; }

	var station;	
	//console.log(desc.status+','+desc.name);
	if (desc.status == 'OPEN' && desc.available_bikes > 0) {
		//station = L.marker([desc.position.lat, desc.position.lng]);
		station = L.circle([desc.position.lat, desc.position.lng], 25, {
			color: 'green',
		});
	} else {
		station = L.circle([desc.position.lat, desc.position.lng], 25, {
			color: 'red',
		});
	}
	station.bindPopup('<b>'+desc.name+'</b><br/>bikes: '+desc.available_bikes);
	station.addTo(mymap);

	station._velib = desc;
	stations[desc.number] = station;
};

function update_station(id, field, data) {
	var station = stations[id];
	if ( !station ) { return; }

	//console.log(station._velib.name);
	if (field == 'available_bikes') {
		if ( data.newval == 0) {
			station.setStyle({color: 'red'});
			msg = '<b>running out of bikes</b>';
		} else if ( station._velib[field] == 0 ) {
			station.setStyle({color: 'green'});
			msg = '<b>hopefully, '+data.newval+' more bike(s) available</b>';
		} else {
			msg = (data.newval > data.oldval) ?
				(data.newval - data.oldval)+ " bike(s) back home" :
				(data.oldval - data.newval)+ " bike(s) on the way";
		}

		station._popup.setContent('<b>'+station._velib.name+'</b><br/>bikes: '+data.newval);

		name = name_fmt(station._velib.name);
		//console.log(name);
		evt = $('<li vid="'+id+'"><span>'+name+'</span>: ' + msg +'</li>')
		var next = $('li[horizon=1]')
			.html('<span>'+name+'</span>: '+msg)
			.attr('horizon',0)
			.attr('id', id)
			.next().html('').attr('horizon',1)
		if ( next.length == 0) {
			$('li').first().attr('horizon',1);
		}
	}
	station._velib[field] = data.newval;

 
}

function name_fmt(name) {
	return name.split('-')[1].trim();
}

map_init();
mqtt_init();

// populate list with empty li's
for(var i = 0; i < 40; i++) {
	elt = $('<li></li>').click(function() {
		console.log($(this).attr('id'));
		stations[$(this).attr('id')].openPopup();
	});
	$('ul').append(elt);
}
$('li').first().attr('horizon', 1);
