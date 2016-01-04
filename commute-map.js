CommuteMap = function(instance, options, callbacks, features) {
  var self = this;
  this.instance = instance;
  _.defaults(options, {
    mergeMarkers: true,
    markerStyles: {
      default: {
        fillColor: '#2c577d',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeOpacity: 1,
        strokeWeight: 1.3,
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12
      },
      active: {
        fillColor: '#fff',
        fillOpacity: 1,
        strokeColor: '#2c577d',
        strokeOpacity: 1,
        strokeWeight: 1.3,
        path: google.maps.SymbolPath.CIRCLE,
        scale: 15
      },
      highlighted: {
        fillColor: '#fff',
        fillOpacity: 1,
        strokeColor: '#2c577d',
        strokeOpacity: 1,
        strokeWeight: 1.3,
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12
      }
    },
    useClustering: true,
    clustererAverageCenter: true,
    clustererMaxZoom: 13,
    clustererStyles: {
      default: {
        url: '/packages/lmachens_commute-maps/images/clusterer.png',
        textColor: '#fff',
        backgroundPosition: '0 0',
        width: 53,
        height: 52
      },
      active: {
        url: '/packages/lmachens_commute-maps/images/clusterer_active.png',
        textColor: '#2c577d',
        backgroundPosition: '0 0',
        width: 55,
        height: 54
      },
      highlighted: {
        url: '/packages/lmachens_commute-maps/images/clusterer_highlighted.png',
        textColor: '#2c577d',
        backgroundPosition: '0 0',
        width: 55,
        height: 54
      }
    },
    showCenterMarker: true,
    centerMarkerStyle: {
      url: '/packages/lmachens_commute-maps/images/center.png',
      size: new google.maps.Size(27, 27),
      origin: new google.maps.Point(0,0),
      anchor: new google.maps.Point(15, 15)
    },
    boundsMode: 'byDistance',
    distanceRadius: 2000,
    boundsByDistanceStyle: {
      stroke_weight: 3,
      stroke_color: '#4E87B6',
      resize_leftright: '/packages/lmachens_commute-maps/images/resize_leftright.png'
    },
    useMiles: false,
    boundsModeZoomThreshhold: 11,
    travelMode: 'DRIVING'
  });
  this.options = options;

  _.defaults(callbacks, {
    markerSelected: function(marker) {},
    markerDeselected: function(marker) {},
    mapBoundsChanged: function(geospatialQuery, primaryBounds) {},
    distanceBoundsChanged: function(geospatialQuery, primaryBounds) {},
    showHiddenMarkersChanged: function(showHiddenMarkers) {},
    travelModeChanged: function(travelMode) {}
  });
  this.callbacks = callbacks;

  this.markers = {};

  if (options.useClustering) {
    this.initClusterer();
  }

  if (options.useMiles) {
    this.earthDistance =  3963.2; // miles
  } else {
    this.earthDistance = 6378100; // meters
  }

  // workaround for overlapping marker labels
  this.hoverOffset = 80000;
  this.selectedMarker = null;

  // map click listener to unselect selected marker
  this.instance.addListener('click', function() {
    if (self.selectedMarker) {
      self.deselectSelectedMarker();
      self.hideRoute();
    }
  });

  // listens when map changes location or zoom
  this.instance.addListener('bounds_changed', function() {
    var primaryBounds = self.instance.getZoom() <= options.boundsModeZoomThreshhold;

    var bounds = this.getBounds();
    // get corners
    var ne = bounds.getNorthEast()
    var sw = bounds.getSouthWest()

    // deselect marker if out of bounds
    if (self.selectedMarker && !bounds.contains(self.selectedMarker.getPosition())) {
      self.callbacks.markerDeselected(self.selectedMarker);
    }

    self.callbacks.mapBoundsChanged({
      $geoWithin: {
        $geometry: {
          type : "Polygon" ,
          coordinates: [ [
            [sw.lng(), sw.lat()], // SW
            [sw.lng(), ne.lat()], // NW
            [ne.lng(), ne.lat()], // NE
            [ne.lng(), sw.lat()], // SE
            [sw.lng(), sw.lat()]  // SW (close polygon)
          ] ]
        }
      }
    }, primaryBounds);
  });

  this.instance.addListener('zoom_changed', function() {
    var visible = this.getZoom() > options.boundsModeZoomThreshhold;
    // center invertedCircle if it is getting visible
    if (visible && !self.centerMarker.getVisible()) {
      self.centerMarker.setCenter(self.instance.getCenter());
    }
    // set invertedCircle visible depending on zoom level
    self.centerMarker.setVisible(visible);
  });

  if (options.showCenterMarker) {
    this.centerMarker = new InvertedCircle({
      map: this.instance,
      visible: options.boundsMode === 'byDistance' && this.instance.getZoom() > options.boundsModeZoomThreshhold,
      center: new google.maps.LatLng(options.center),
      radius: options.distanceRadius,
      draggable: true,
      editable: true,
      stroke_weight: options.boundsByDistanceStyle.stroke_weight,
      stroke_color: options.boundsByDistanceStyle.stroke_color,
      resize_leftright: options.boundsByDistanceStyle.resize_leftright,
      center_icon: options.centerMarkerStyle,
      position_changed_event: _.throttle(function(position) {
        self.callbacks.distanceBoundsChanged({
          $geoWithin: {
            $centerSphere: [
              [ position.lng(), position.lat() ],
              self.centerMarker.getRadius() / self.earthDistance
            ]
          }
        });
        self.displayRoute();
      }, 200),
      radius_changed_event: _.throttle(function(radius) {
        var center = self.centerMarker.getCenter();
        self.callbacks.distanceBoundsChanged({
          $geoWithin: {
            $centerSphere: [
              [ center.lng(), center.lat() ],
              radius / self.earthDistance
            ]
          }
        });
      }, 200)
    });
    if (this.centerMarker.getVisible()) {
      this.callbacks.distanceBoundsChanged({
        $geoWithin: {
          $centerSphere: [
            [ options.center.lng, options.center.lat ],
            options.distanceRadius / self.earthDistance
          ]
        }
      });
    }
  }

  // add features like neighbourhoods
  if (features) {
    _.each(features, function(feature) {
      self.instance.data.addGeoJson(feature);
    });
  }

  // Init directions renderer and travel modes
  self.directionsDisplay = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    suppressInfoWindows: false,
    preserveViewport: true
  });

  self.directionsService = new google.maps.DirectionsService();
  self.directionsDisplay.setMap(this.instance);
  self.directionsInfoWindow = new google.maps.InfoWindow();

  // hide x-button in infoWindow (not the best solution..)
  google.maps.event.addListener(this.directionsInfoWindow, 'domready', function() {
    $(".gm-style-iw").next("div").hide();
  });
}

CommuteMap.prototype.initClusterer = function() {
  var self = this;
  this.markerClusterer = new MarkerClusterer(this.instance);
  this.markerClusterer.setAverageCenter(this.options.clustererAverageCenter);
  this.markerClusterer.setMaxZoom(this.options.clustererMaxZoom);
  this.markerClusterer.setStyles([
    this.options.clustererStyles.default,
    this.options.clustererStyles.active
  ]);

  // set function which calculates number inside the marker (shows number of flats)
  this.markerClusterer.setCalculator(function(markers, numStyles) {
    var markerIDs = 0;
    var index = 1;
    _.each(markers, function(marker) {
      markerIDs += marker.markerIDs.length;
    });

    if (self.selectedMarker && markers.indexOf(self.selectedMarker) !== -1) {
      index = 2;
    }
    return {
      text: markerIDs.toString(),
      index: index,
      title: ''
    };
  });

  // hover effects
  google.maps.event.addListener(this.markerClusterer, 'mouseover', function(cluster) {
    if (self.selectedMarker && cluster.getMarkers().indexOf(self.selectedMarker) !== -1) {
      return;
    }
    self.highlightCluster(cluster);
  });

  google.maps.event.addListener(this.markerClusterer, 'mouseout', function(cluster) {
    if (self.selectedMarker && cluster.getMarkers().indexOf(self.selectedMarker) !== -1) {
      return;
    }
    self.lowlightCluster(cluster);
  });
}

CommuteMap.prototype.highlightCluster = function(cluster) {
  cluster.clusterIcon_.div_.firstChild.src = this.options.clustererStyles.highlighted.url;
  $(cluster.clusterIcon_.div_.lastChild).css('color', this.options.clustererStyles.highlighted.textColor);
}

CommuteMap.prototype.lowlightCluster = function(cluster) {
  cluster.clusterIcon_.div_.firstChild.src = this.options.clustererStyles.default.url;
  $(cluster.clusterIcon_.div_.lastChild).css('color', this.options.clustererStyles.default.textColor);
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
    var pairedCoordinates = markerProperties.pairedCoordinates;
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

CommuteMap.prototype.removeMarker = function(markerProperties) {
  var marker = this.markers[markerProperties.pairedCoordinates];
  if (marker) {
    var index = marker.markerIDs.indexOf(markerProperties._id);
    if (index > -1) {
      marker.markerIDs.splice(index, 1);
      // update number of flats in marker
      var numberOfMarkerIDs = marker.markerIDs.length;
      marker.set('labelContent', numberOfMarkerIDs.toString());
      if (numberOfMarkerIDs < 10) {
        marker.set('labelAnchor', new google.maps.Point(3, 7));
      }

      // remove Marker if empty
      if (marker.markerIDs.length == 0) {
        marker.setMap(null);
        // remove marker from clusterer
        this.markerClusterer.removeMarker(marker);
        delete this.markers[markerProperties.pairedCoordinates];
      }
    }
  }
}

CommuteMap.prototype.createMarker = function(options) {
  var self = this;
  var markerWithLabel = new MarkerWithLabel({
    position: new google.maps.LatLng(options.position.coordinates[1], options.position.coordinates[0]),
    map: this.instance,
    pairedCoordinates: options.pairedCoordinates,
    markerIDs: [options._id],
    iconScale: this.options.markerStyles.default.scale,
    icon: this.options.markerStyles.default,
    labelClass: 'gmaps-marker',
    labelInBackground: false,
    labelAnchor: new google.maps.Point(3, 7),
    oldZIndex: null
  });
  // workaround for overlapping marker labels
  markerWithLabel.setZIndex(this.hoverOffset);
  this.hoverOffset += 2;

  // Add hover effects
  markerWithLabel.addListener('mouseover', function() {
    if (this !== self.selectedMarker) {
      self.highlightMarker(this);
    }
  });
  markerWithLabel.addListener('mouseout', function() {
    if (this !== self.selectedMarker) {
      self.lowlightMarker(this);
    }
  });

  markerWithLabel.addListener('click', function() {
    if (self.selectedMarker) {
      self.lowlightMarker(self.selectedMarker);
    }
    if (this === self.selectedMarker) {
      self.selectedMarker = null;
      self.callbacks.markerDeselected(this);
      self.hideRoute();
    } else {
      self.selectMarker(this);
      self.selectedMarker = this;
      self.callbacks.markerSelected(this);
      self.displayRoute();
    }
  });

  this.markers[markerWithLabel.pairedCoordinates] = markerWithLabel;
  // add marker to clusterer
  this.markerClusterer.addMarker(markerWithLabel);
}

CommuteMap.prototype.selectMarker = function(marker) {
  marker.setIcon(this.options.markerStyles.active);
  marker.set('labelStyle', {
    color: this.options.markerStyles.active.strokeColor
  });

  if (marker.oldZIndex == null) {
    marker.oldZIndex = marker.getZIndex();
  }
  marker.setZIndex(google.maps.Marker.MAX_ZINDEX - 2);

  // highlight cluster if marker is inside
  if (marker.getMap() == null) {
    cluster = this.markerClusterer.getClusterOfMarker(marker);
    if (cluster && cluster.clusterIcon_.div_ && cluster.clusterIcon_.div_.firstChild) {
      this.highlightCluster(cluster);
    }
  }
}

CommuteMap.prototype.deselectSelectedMarker = function() {
  var cluster = this.markerClusterer.getClusterOfMarker(this.selectedMarker);
  if (cluster) {
    cluster.updateIcon_()
  }
  this.lowlightMarker(this.selectedMarker);
  this.callbacks.markerDeselected(this.selectedMarker);
  this.selectedMarker = null;
}

CommuteMap.prototype.highlightMarker = function(marker) {
  marker.setIcon(this.options.markerStyles.highlighted);

  marker.set('labelStyle', {
    color: this.options.markerStyles.highlighted.strokeColor
  });

  if (marker.oldZIndex == null) {
    marker.oldZIndex = marker.getZIndex();
  }
  marker.setZIndex(google.maps.Marker.MAX_ZINDEX);

  // highlight cluster if marker is inside
  if (marker.getMap() === null) {
    cluster = this.markerClusterer.getClusterOfMarker(marker);
    if (cluster && cluster.clusterIcon_.div_ && cluster.clusterIcon_.div_.firstChild) {
      this.highlightCluster(cluster);
    }
  }
}

CommuteMap.prototype.lowlightMarker = function(marker) {
  marker.setIcon(this.options.markerStyles.default);
  marker.set('labelStyle', {});
  marker.setZIndex(marker.oldZIndex);
  marker.oldZIndex = null;

  // lowlight cluster if marker is inside
  if (marker.getMap() == null) {
    var cluster = this.markerClusterer.getClusterOfMarker(marker);
    if (cluster && cluster.clusterIcon_.div_ && cluster.clusterIcon_.div_.firstChild) {
      this.lowlightCluster(cluster);
    }
  }
}

CommuteMap.prototype.setTravelMode = function(travelMode, isActive) {
  this.options.travelMode = travelMode;
  this.displayRoute();
  this.callbacks.travelModeChanged(travelMode);
}

CommuteMap.prototype.getTravelMode = function() {
  return this.options.travelMode;
}

CommuteMap.prototype.displayRoute = function() {
  if (!this.selectedMarker || !this.centerMarker.getVisible()) {
    return;
  }
  var self = this;
  this.directionsService.route({
    origin: this.centerMarker.position,
    destination: this.selectedMarker.position,
    travelMode: google.maps.TravelMode[this.options.travelMode]
  }, function (response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      self.directionsDisplay.setDirections(response);
      var content = self.createInfoWindowContent(response);
      self.directionsDisplay.setMap(self.instance);
      self.directionsInfoWindow.setContent(content);
      self.directionsInfoWindow.open(self.instance, self.selectedMarker);
    }
  });
}

CommuteMap.prototype.createInfoWindowContent = function(data) {
  var route = data.routes[0].legs[0];
  var icon = '';
  switch (data.request.travelMode) {
    case 'DRIVING': icon = 'fa fa-car fa-lg'; break;
    case 'TRANSIT': icon = 'fa fa-train fa-lg'; break;
    case 'WALKING': icon = 'fa fa-male fa-lg'; break;
    case 'BICYCLING': icon = 'fa fa-bicycle fa-lg'; break;
  }

  return '<i class="' + icon + '"></i> <b>' + route.distance.text + '</b><br>' + route.duration.text;
}

CommuteMap.prototype.hideRoute = function() {
  this.directionsDisplay.setMap(null);
  this.directionsInfoWindow.close();
}
