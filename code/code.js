//import GreenScreen from "GreenScreen.js";

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
viewer.clock.onTick.addEventListener(function(clock) {
  viewer.scene.camera.rotateRight(0.005);
});

// Grid square to lat long util
// from https://gist.github.com/DrPaulBrewer/4279e9d234a1bd6dd3c0
gridSquareToLatLon = function(grid, obj){
  var returnLatLonConstructor = (typeof(LatLon)==='function');
  var returnObj = (typeof(obj)==='object');
  var lat=0.0,lon=0.0,aNum="a".charCodeAt(0),numA="A".charCodeAt(0);
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
  } else if (/^[A-X][A-X][0-9][0-9][a-x][a-x]$/.test(grid)){
    lat = lat4(grid)+(1.0/60.0)*2.5*(grid.charCodeAt(5)-aNum+0.5);
    lon = lon4(grid)+(1.0/60.0)*5*(grid.charCodeAt(4)-aNum+0.5);
  } else throw "gridSquareToLatLon: invalid grid: "+grid;
  if (returnLatLonConstructor) return new LatLon(lat,lon);
  if (returnObj){
    obj.lat = lat;
    obj.lon = lon;
    return obj;
  }
  return [lat,lon];
};

// Fetch data
$.ajax({
  url: "data.csv",
  success: async function(result) {
    // Variable setup
    var markedCallsigns = [];
    var tableContent = "";

    // Parse the CSV
    data = $.csv.toArrays(result);
    data.forEach(row => {
      // Extract data for the spot
      var time = moment.unix(row[1]);
      var receiver = row[2];
      var receiverGrid = row[3];
      var receiverLL = gridSquareToLatLon(receiverGrid);
      var transmitter = row[6];
      var transmitterGrid = row[7];
      var transmitterLL = gridSquareToLatLon(transmitterGrid);

      // Draw a line for the spot
      viewer.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArray([transmitterLL[1], transmitterLL[0], receiverLL[1], receiverLL[0]]), width: 2} });

      // Draw points for the callsigns if not already done
      if (!markedCallsigns.includes(transmitter)) {
        viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(transmitterLL[1], transmitterLL[0]), label: { text: transmitter, font: "16px Arial", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 4, style: Cesium.LabelStyle.FILL_AND_OUTLINE } });
        markedCallsigns.push(transmitter);
      }
      if (!markedCallsigns.includes(receiver)) {
        viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(receiverLL[1], receiverLL[0]), label: { text: receiver, font: "16px Arial", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 4, style: Cesium.LabelStyle.FILL_AND_OUTLINE } });
        markedCallsigns.push(receiver);
      }

      // Add data to table
      tableContent += "<tr><td>" + time.format("hh:mm:ss") + "</td><td>" + transmitter + "</td><td>" + transmitterGrid + "</td><td>" + receiver + "</td><td>" + receiverGrid + "</td></tr>";
    });

    // Update table in DOM
    $('#spottablecontent').html(tableContent);
  }
});

