// Own station properties
var owncall = "2E0UXV";
var owngrid = "IO90bs";
var maxspots = 100;

// Set up Cesium
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZWVjNWJhYS1hNjUyLTRkYWEtODE5MC1hMWFkYWQ0NzBhYTEiLCJpZCI6NjkxMDEsImlhdCI6MTYzMzE2MTI2OX0._M65C5gcKo2ou4xpXbbcS6JC6hobPcPQ7Cos4VOxdEE';
const viewer = new Cesium.Viewer('map', {
  baseLayerPicker : false,
  timeline: false,
  animation: false
});

// Hide the skybox and atmosphere
viewer.scene.skyBox.destroy();
viewer.scene.skyBox = undefined;
viewer.scene.sun.destroy();
viewer.scene.sun = undefined;
viewer.scene.backgroundColor = Cesium.Color.BLACK;
viewer.scene.skyAtmosphere.show = false;
viewer.scene.fog.enabled = false;
viewer.scene.globe.showGroundAtmosphere = false;

// Set up layers
viewer.scene.globe.imageryLayers.removeAll();
viewer.scene.globe.baseColor = Cesium.Color.BLACK;
var tonerLayer = viewer.scene.globe.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
        url : 'https://stamen-tiles.a.ssl.fastly.net/toner-background/',
        credit : 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under CC BY SA.'
    })
);
tonerLayer.alpha = 0.3;

// Set up green filter post-processing
var stages = viewer.scene.postProcessStages;
stages.add(new Cesium.PostProcessStage({
    fragmentShader : "uniform sampler2D colorTexture;\n\
\n\
varying vec2 v_textureCoordinates;\n\
\n\
void main(void)\n\
{\n\
    vec3 rgb = texture2D(colorTexture, v_textureCoordinates).rgb;\n\
    vec3 green = vec3(0.0, 1.0, 0.0);\n\
    gl_FragColor = vec4(rgb * green, 1.0);\n\
}\n\
"
}));

// Set initial view
viewer.camera.setView({
  destination : Cesium.Cartesian3.fromDegrees(0, 20, 12000000),
});

// Orbit this point
var unsubscribeGlobeSpinEventListener = viewer.clock.onTick.addEventListener(function(clock) {
  viewer.scene.camera.rotateRight(0.005);
});

// Define grid square to lat long util
// from https://gist.github.com/DrPaulBrewer/4279e9d234a1bd6dd3c0
gridSquareToLatLon = function(grid, obj){
  grid = grid.toUpperCase();
  var returnLatLonConstructor = (typeof(LatLon)==='function');
  var returnObj = (typeof(obj)==='object');
  var lat=0.0,lon=0.0,numA="A".charCodeAt(0);
  function lat4(g){
    return 10*(g.charCodeAt(1)-numA)+parseInt(g.charAt(3))-90;
  }
  function lon4(g){
    return 20*(g.charCodeAt(0)-numA)+2*parseInt(g.charAt(2))-180;
  }
  if ((grid.length!=4) && (grid.length!=6)) throw "gridSquareToLatLon: grid must be 4 or 6 chars: "+grid;
  if (/^[A-X][A-X][0-9][0-9]$/.test(grid)){
    lat = lat4(grid)+0.5;
    lon = lon4(grid)+1;
  } else if (/^[A-X][A-X][0-9][0-9][A-X][A-X]$/.test(grid)){
    lat = lat4(grid)+(1.0/60.0)*2.5*(grid.charCodeAt(5)-numA+0.5);
    lon = lon4(grid)+(1.0/60.0)*5*(grid.charCodeAt(4)-numA+0.5);
  } else throw "gridSquareToLatLon: invalid grid: "+grid;
  if (returnLatLonConstructor) return new LatLon(lat,lon);
  if (returnObj){
    obj.lat = lat;
    obj.lon = lon;
    return obj;
  }
  return [lat,lon];
};

// Draw receiving station label
var ownlatlon = gridSquareToLatLon(owngrid);
viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(ownlatlon[1], ownlatlon[0]), label: { text: owncall, font: "16px Arial", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 4, style: Cesium.LabelStyle.FILL_AND_OUTLINE } });

// Fetch data
$.ajax({
  url: "data/ALL_WSPR.TXT",
  success: async function(result) {
    // Variable setup
    var markedCallsigns = [];
    var tableContent = "";

    // Parse the file
    data = result.split('\n');

    // Reverse the order so start from the most recent
    data.reverse();
    data.forEach(line => {
      // Identify lines that represent receives, not transmits
      if (line.charAt(6) == " ") {
        console.log(line);

        // Extract data for the spot
        var time = line.substring(7, 11);
        var rxSNR = line.substring(12, 15).trim();
        var wsprData = line.substring(35, 58).trim();
        var wsprDataSplit = wsprData.split(/\s+/);

        // Only parse lines where we have a call, grid and power - multipart messages are ignored for now
        console.log(wsprDataSplit.length);
        if (wsprDataSplit.length == 3) {
          var txcall = wsprDataSplit[0];
          var txgrid = wsprDataSplit[1];
          var txlatlon = gridSquareToLatLon(txgrid);
          var txPower = wsprDataSplit[2];

          // Tidy up tx call for display and reject anything wrong-looking
          txcall = txcall.replaceAll("<", "").replaceAll(">", "");
          if (txcall != "..." && txcall != "" && !txcall.startsWith("0")) {

            // If this is a new callsign and we have space for more, draw a label and line on the globe, then add a line to the table
            if (!markedCallsigns.includes(txcall) && markedCallsigns.length < maxspots) {
              viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(txlatlon[1], txlatlon[0]), label: { text: txcall, font: "16px Arial", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 4, style: Cesium.LabelStyle.FILL_AND_OUTLINE } });
              viewer.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArray([txlatlon[1], txlatlon[0], ownlatlon[1], ownlatlon[0]]), width: 2} });

              tableContent += "<tr><td>" + time + "</td><td>" + txcall + "</td><td>" + txgrid + "</td><td>" + txPower + "</td><td>" + rxSNR + "</td></tr>";

              markedCallsigns.push(txcall);
            }
          }
        }
      }
    });

    // Update table in DOM
    $('#spottablecontent').html(tableContent);
  }
});

// On user mouse down on globe, stop automatic rotation
var handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
handler.setInputAction(
    function(click) {
      unsubscribeGlobeSpinEventListener();
    },
    Cesium.ScreenSpaceEventType.LEFT_DOWN
);