CommuteMap = function(instance, options) {
  this.instance = instance;
  _.defaults(options, {
      mergeMarkers: true,
      markerDefaultIcon: {
        fillColor: '#2c577d',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeOpacity: 1,
        strokeWeight: 1.3,
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12
      },
      useClustering: true
  });

  this.options = options;
  this.markers = {};

  if (options.useClustering) {
    this.initClusterer();
  }

}

CommuteMap.prototype.initClusterer = function() {
  this.markerClusterer = new MarkerClusterer(this.instance);
  this.markerClusterer.setAverageCenter(true);
  this.markerClusterer.setMaxZoom(13);
  this.markerClusterer.setStyles([
    {
      url: '/packages/lmachens_commute-maps/images/clusterer.png',
      textColor: '#fff',
      backgroundPosition: '0 0',
      width: 53,
      height: 52
    }, {
      url: '/packages/lmachens_commute-maps/images/clusterer_active.png',
      textColor: '#2c577d',
      backgroundPosition: '0 0',
      width: 55,
      height: 54
    }
  ]);
/*
  this.markerClusterer.setCalculator((function(_this) {
    return function(markers, numStyles) {
      var flats, index;
      flats = 0;
      index = 1;
      return _.each(markers, function(marker) {
        flats += marker.flats.length;
        if (this.markerClicked && markers.indexOf(this.markerClicked) !== -1) {
          index = 2;
          ({
            text: flats.toString(),
            index: index,
            title: ''
          });
          google.maps.event.addListener(this.markerClusterer, 'mouseover', (function(_this) {
            return function(cluster) {
              if (_this.markerClicked && cluster.getMarkers().indexOf(_this.markerClicked) !== -1) {
                return;
              }
              _this.highlightCluster(cluster);
            };
          })(this));
          return google.maps.event.addListener(this.markerClusterer, 'mouseout', (function(_this) {
            return function(cluster) {
              if (_this.markerClicked && cluster.getMarkers().indexOf(_this.markerClicked) !== -1) {
                return;
              }
              _this.lowlightCluster(cluster);
            };
          })(this));
        }
      });
    };
  })(this));*/
}

CommuteMap.prototype.zoomIn = function() {
  this.instance.setZoom(this.instance.getZoom() + 1);
}

CommuteMap.prototype.zoomOut = function() {
  this.instance.setZoom(this.instance.getZoom() - 1);
}

CommuteMap.prototype.addMarker = function(markerProperties) {
  if (this.options.mergeMarkers) {
    // check if a marker was added on same position
    var pairedCoordinates = markerProperties.position.pairedCoordinates;
    if (this.markers[pairedCoordinates]) {
      this.markers[pairedCoordinates].markerIDs.push(markerProperties._id);
    } else {
      this.createMarker(markerProperties);
    }

    // show number of submarkers
    var number = this.markers[pairedCoordinates].markerIDs.length;
    this.markers[pairedCoordinates].set('labelContent', number.toString());
    if (number > 9) {
      this.markers[pairedCoordinates].set('labelAnchor', new google.maps.Point(6, 7));
    }

  } else {
    this.createMarker(markerProperties);
  }
}

CommuteMap.prototype.removeMarker = function(marker) {

}

CommuteMap.prototype.createMarker = function(marker) {
  var markerWithLabel = new MarkerWithLabel({
    position: new google.maps.LatLng(marker.position.coordinates[1], marker.position.coordinates[0]),
    map: this.instance,
    pairedCoordinates: marker.position.pairedCoordinates,
    markerIDs: [marker._id],
    iconScale: this.options.markerDefaultIcon.scale,
    icon: this.options.markerDefaultIcon,
    labelClass: 'gmaps-marker',
    labelInBackground: false,
    labelAnchor: new google.maps.Point(3, 7)
  });
  this.markers[markerWithLabel.pairedCoordinates] = markerWithLabel;
  // add marker to clusterer
  this.markerClusterer.addMarker(markerWithLabel);
}
