CommuteMap = function(instance, collection, options, callbacks, features) {
  var self = this;
  this.collection = collection;

  this.instance = instance;
  _.defaults(options, {
    simpleMode: false,
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
    clustererMaxZoom: 11,
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
    boundsMode: 'byDistance',
    distanceRadius: 2000,
    useMiles: false,
    boundsModeZoomThreshhold: 11,
    travelMode: 'DRIVING',
    collectionFilters: {},
    enterAddressLabel: 'Enter Address'
  });
  this.options = options;
  this.boundsMode = new ReactiveVar(options.boundsMode);
  if (!options.boundsByDistanceStyle) {
    options.boundsByDistanceStyle  = {};
  }
  this.options.boundsByDistanceStyle = _.defaults(options.boundsByDistanceStyle, {
    stroke_weight: 3,
    stroke_color: '#4E87B6',
    resize_leftright: '/packages/lmachens_commute-maps/images/resize_leftright.png'
  });
  if (!options.centerMarkerStyle) {
    options.centerMarkerStyle  = {};
  }
  this.options.centerMarkerStyle = _.defaults(options.centerMarkerStyle, {
    url: '/packages/lmachens_commute-maps/images/center.png',
    size: new google.maps.Size(27, 27),
    origin: new google.maps.Point(0,0),
    anchor: new google.maps.Point(15, 15)
  });

  if (callbacks == null) {
    callbacks = {};
  }
  _.defaults(callbacks, {
    locationChanged: function(location) {},
    markerSelected: function(marker) {},
    markerDeselected: function(marker) {},
    mapBoundsChanged: function(geospatialQuery, primaryBounds) {},
    distanceBoundsChanged: function(geospatialQuery, primaryBounds) {},
    showHiddenMarkersChanged: function(showHiddenMarkers) {},
    travelModeChanged: function(travelMode) {},
    showcaseMarkersInfos: function(pairedCoordinates, infos) {},
    showcaseMarkerAdded: function(marker) {},
    showcaseMarkerRemoved: function(marker) {}
  });
  this.callbacks = callbacks;

  this.markers = {};
  this.showcaseMarkers = {};

  if (!this.options.simpleMode && options.useClustering) {
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
    self.deselectSelectedMarker();
  });

  // listens when map changes location or zoom
  this.instance.addListener('bounds_changed', function() {
    var primaryBounds = self.boundsMode.get() !== 'byDistance';
    self.callMapBoundsChanged(primaryBounds);

    // check if inverted circle is still in bounds
    if (!primaryBounds && !self.centerMarker.getBounds().intersects(self.instance.getBounds())) {
      self.centerMarker.setCenter(self.instance.getCenter());
      self.centerMarker.triggerPositionChangedEvent();
    }
  });

  this.instance.addListener('zoom_changed', _.debounce(function() {
    if (self.boundsMode.get() !== 'byDistance') {
      return;
    }
    var visible = this.getZoom() > options.boundsModeZoomThreshhold;
    // center invertedCircle if it is getting visible
    /*if (visible && !self.centerMarker.getVisible()) {
      self.centerMarker.setCenter(self.instance.getCenter(), true);
      self.getMarkerInfosMatrix();
    } else if (!visible && self.centerMarker.getVisible()){
      _.each(self.showcaseMarkers, function(marker) {
        self.callbacks.showcaseMarkersInfos(marker.pairedCoordinates, null);
      });
    }*/
    // set invertedCircle visible depending on zoom level
    self.setInvertedCircleVisibility(visible);
  }), 300);

  if (!this.options.simpleMode && options.showCenterMarker) {
    this.centerMarker = new InvertedCircle({
      map: this.instance,
      visible: self.boundsMode.get() === 'byDistance' && this.instance.getZoom() > options.boundsModeZoomThreshhold,
      center: new google.maps.LatLng(options.center),
      radius: options.distanceRadius,
      defaultZoom: options.zoom,
      draggable: true,
      editable: true,
      always_fit_to_map: false,
      stroke_weight: options.boundsByDistanceStyle.stroke_weight,
      stroke_color: options.boundsByDistanceStyle.stroke_color,
      resize_leftright: options.boundsByDistanceStyle.resize_leftright,
      center_icon: options.centerMarkerStyle,
      enterAddressLabel: options.enterAddressLabel,
      locationChanged: function(results) {
        self.setLocationByGeocoderResults(results);
      },
      position_changed_event: _.throttle(function(position, deselectMarker) {
        if (deselectMarker) {
          self.deselectSelectedMarker();
        }
        var primaryBounds = self.boundsMode.get() === 'byDistance';
        self.callbacks.distanceBoundsChanged({
          $geoWithin: {
            $centerSphere: [
              [ position.lng(), position.lat() ],
              self.centerMarker.getRadius() / self.earthDistance
            ]
          }
        }, primaryBounds);
        self.displayRoute(self.selectedMarker);
      }, 200),
      radius_changed_event: _.throttle(function(radius) {
        var primaryBounds = self.boundsMode.get() === 'byDistance';
        var center = self.centerMarker.getCenter();
        self.callbacks.distanceBoundsChanged({
          $geoWithin: {
            $centerSphere: [
              [ center.lng(), center.lat() ],
              radius / self.earthDistance
            ]
          }
        }, primaryBounds);
      }, 200),
      clicked_event: function() {
        if (self.selectedMarker) {
          self.deselectSelectedMarker();
        }
      }
    });

    //this.centerMarker.openAddressOverlay();

    if (this.centerMarker.getVisible()) {
      this.callbacks.distanceBoundsChanged({
        $geoWithin: {
          $centerSphere: [
            [ options.center.lng, options.center.lat ],
            options.distanceRadius / self.earthDistance
          ]
        }
      }, true);
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
  self.distanceMatrixService = new google.maps.DistanceMatrixService();
  self.directionsDisplay.setMap(this.instance);
  self.directionsInfoWindow = new google.maps.InfoWindow();
  self.geocoder = new google.maps.Geocoder();
  // hide x-button in infoWindow (not the best solution..)
  /*google.maps.event.addListener(this.directionsInfoWindow, 'domready', function() {
    $(".gm-style-iw").next("div").hide();
  });*/

  // travelInfo caching
  self.cachedTravelInfos = {
    origin: null,
    'DRIVING': {},
    'TRANSIT': {},
    'WALKING': {},
    'BICYCLING': {}
  };

  // show transit layer
  this.transitLayer = new google.maps.TransitLayer();
  this.transitLayer.setMap(this.instance);

  // collections
  /*this.observe = collection.find(this.options.collectionFilters).observe({
    removed: function (marker) {
      self.removeMarker(marker);
    },
    added: function(marker, index) {
      self.addMarker(marker);
    }
  });*/
}

CommuteMap.prototype.destroy = function() {
  //this.observe.stop();
  //this.observeShowcase.stop();
}

CommuteMap.prototype.callMapBoundsChanged = _.debounce(function (primaryBounds) {
  var bounds = this.instance.getBounds();
  // get corners
  var ne = bounds.getNorthEast()
  var sw = bounds.getSouthWest()

  this.callbacks.mapBoundsChanged({
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
}, 300);

CommuteMap.prototype.startObservingShowcase = function(filter) {
  if (!filter) {
    filter = {};
  }
  var self = this;
  this.removeShowcaseMarkers();
  this.collection.remove({});

  _.each(this.markers, function (marker) {
    _.each(marker.markerDatas, function(data) {
      self.collection.insert(data);
    });
  });
  var showcaseMarkers = this.collection.find(filter, this.options.showcaseQuery).fetch();
  _.each(showcaseMarkers, function(marker) {
    self.addShowcaseMarker(marker);
  });
  /*
  if (this.observeShowcase) {
    this.observeShowcase.stop();
    _.each(this.showcaseMarkers, function(marker) {
      self.callbacks.showcaseMarkerRemoved(marker);
    });
    self.removeShowcaseMarkers();
  }
  if (!filter) {
    filter = {};
  }
  this.observeShowcase = this.collection.find(filter, this.options.showcaseQuery).observeChanges({
    removed: function(id) {
      self.removeShowcaseMarkerById(id);
    },
    addedBefore: function(id, fields, before) {
      self.addShowcaseMarker(
        _.extend({_id: id}, fields)
      );
    }
  });*/
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

  // overrides the zoom level on cluster click
  this.markerClusterer.setZoomOnClick(false);
  google.maps.event.addListener(this.markerClusterer, 'clusterclick', function(cluster){
    self.instance.setCenter(cluster.getCenter());
    self.instance.setZoom(self.options.clustererMaxZoom + 2);
  });

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

CommuteMap.prototype.setCenter = function(center, zoom) {
  if (zoom) {
    this.instance.setZoom(zoom);
  }
  this.instance.setCenter(center);
  this.centerMarker.setCenter(this.instance.getCenter());
  this.centerMarker.triggerPositionChangedEvent();
}

CommuteMap.prototype.setCenterToMapCenter = function() {
  var center = this.instance.getCenter();
  this.setCenter(center);
  this.centerMarker.triggerPositionChangedEvent();
}

CommuteMap.prototype.setBounds = function(bounds) {
  this.instance.fitBounds(bounds);
  this.centerMarker.setCenter(this.instance.getCenter());
  this.centerMarker.triggerPositionChangedEvent();
}

CommuteMap.prototype.centerCenterMarker = function() {
  var center = this.centerMarker.getCenter();
  this.instance.setCenter(center);
}

CommuteMap.prototype.addMarker = function(markerProperties) {
  var self = this;
 if (self.options.mergeMarkers) {
    // check if a marker was added on same position
    var pairedCoordinates = markerProperties.pairedCoordinates;
    if (self.markers[pairedCoordinates]) {
      self.markers[pairedCoordinates].markerIDs.push(markerProperties._id);
      self.markers[pairedCoordinates].markerDatas.push(markerProperties);
    } else {
      self.createMarker(markerProperties);
    }

    // show number of submarkers
    var number = self.markers[pairedCoordinates].markerIDs.length;
    self.markers[pairedCoordinates].set('labelContent', number.toString());
    if (number > 9) {
      self.markers[pairedCoordinates].set('labelAnchor', new google.maps.Point(6, 7));
    }
  } else {
    self.createMarker(markerProperties);
  }
}

CommuteMap.prototype.removeMarkers = function(protectSelectedMarker) {
  var self = this;
  _.each(this.markers, function(marker, key) {
    if (protectSelectedMarker && self.selectedMarker === marker) {
      return;
    }
    marker.setMap(null);
    delete this.markers[key];
  });
}

CommuteMap.prototype.removeMarker = function(markerProperties) {
  var self = this;

  var marker = self.markers[markerProperties.pairedCoordinates];
  if (marker) {
    var index = marker.markerIDs.indexOf(markerProperties._id);
    if (index > -1) {
      marker.markerIDs.splice(index, 1);
      marker.markerDatas.splice(index, 1);
      // update number of flats in marker
      var numberOfMarkerIDs = marker.markerIDs.length;
      marker.set('labelContent', numberOfMarkerIDs.toString());
      if (numberOfMarkerIDs < 10) {
        marker.set('labelAnchor', new google.maps.Point(3, 7));
      }

      // remove Marker if empty
      if (marker.markerIDs.length == 0) {
        // hide route if marker was selected
        if (marker === self.selectedMarker) {
          self.deselectSelectedMarker();
        }
        marker.setMap(null);
        // remove marker from clusterer
        self.markerClusterer.removeMarker(marker);
        delete self.markers[markerProperties.pairedCoordinates];
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
    markerDatas: [options],
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
  if (!this.options.simpleMode) {
    markerWithLabel.addListener('mouseover', function() {
      var marker = this;
      if (this !== self.selectedMarker) {
        self.highlightMarker(this);
      }

      // show route if marker is long hovered
      if (!self.selectedMarker) {
        this.hoverTimer = setTimeout(function(){
          self.displayRoute(marker);
        }, 500);
      }
    });
    markerWithLabel.addListener('mouseout', function() {
      if (this !== self.selectedMarker) {
        self.lowlightMarker(this);
      }

      // hide route after long hovered
      if (!self.selectedMarker) {
        self.hideRoute();
      }
      clearTimeout(this.hoverTimer);
    });

    markerWithLabel.addListener('click', function() {
      if (this === self.selectedMarker) {
        self.deselectSelectedMarker();
      } else {
        self.deselectSelectedMarker();
        self.selectMarker(this);
        self.startObservingShowcase({_id: {$in: this.markerIDs}});
        self.callbacks.markerSelected(this);
        self.displayRoute(self.selectedMarker);
      }
    });
  }

  this.markers[markerWithLabel.pairedCoordinates] = markerWithLabel;
  // add marker to clusterer
  if (this.markerClusterer) {
    this.markerClusterer.addMarker(markerWithLabel);
  }
}

CommuteMap.prototype.selectMarker = function(marker) {
  this.centerMarker.addressOverlay.close();
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
  marker.highlighted = true;
  this.selectedMarker = marker;
}

CommuteMap.prototype.deselectSelectedMarker = function() {
  if (!this.selectedMarker) {
    return;
  }
  var cluster = this.markerClusterer.getClusterOfMarker(this.selectedMarker);
  if (cluster) {
    cluster.updateIcon_()
  }
  var marker = this.selectedMarker;
  this.selectedMarker = null;
  this.lowlightMarker(marker);
  this.hideRoute();
  this.startObservingShowcase();
  this.callbacks.markerDeselected(marker);
}

CommuteMap.prototype.highlightMarker = function(marker) {
  if (marker.highlighted || this.selectedMarker) {
    return;
  }
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
  marker.highlighted = true;
}

CommuteMap.prototype.highlightMarkerByCoordinates = function(pairedCoordinates) {
  if (this.markers[pairedCoordinates]) {
    this.highlightMarker(this.markers[pairedCoordinates]);
  }
}

CommuteMap.prototype.lowlightMarker = function(marker) {
  if (!marker.highlighted || marker === this.selectedMarker) {
    return;
  }
  marker.setIcon(this.options.markerStyles.default);
  marker.set('labelStyle', {
    //color: this.options.markerStyles.default.strokeColor
  });
  marker.setZIndex(marker.oldZIndex);
  marker.oldZIndex = null;

  // lowlight cluster if marker is inside
  if (marker.getMap() == null) {
    var cluster = this.markerClusterer.getClusterOfMarker(marker);
    if (cluster && cluster.clusterIcon_.div_ && cluster.clusterIcon_.div_.firstChild) {
      this.lowlightCluster(cluster);
    }
  }
  marker.highlighted = false;
}

CommuteMap.prototype.lowlightMarkerByCoordinates = function(pairedCoordinates) {
  if (this.markers[pairedCoordinates]) {
    this.lowlightMarker(this.markers[pairedCoordinates]);
  }
}

CommuteMap.prototype.setTravelMode = function(travelMode, isActive) {
  var self = this;
  this.options.travelMode = travelMode;
  this.displayRoute(self.selectedMarker);
  this.callbacks.travelModeChanged(travelMode);
  // refresh showcase markers
  this.getMarkerInfosMatrix();
}

CommuteMap.prototype.getTravelMode = function() {
  return this.options.travelMode;
}

CommuteMap.prototype.displayRoute = function(marker) {
  if (!marker) {
    return;
  }

  var self = this;

  var travelInfo = this.cachedTravelInfos[this.options.travelMode][marker.pairedCoordinates];
  if (this.cachedTravelInfos.origin === this.centerMarker.pairedCoordinates &&
      travelInfo) {
    var content = self.createInfoWindowContent(travelInfo);
      self.directionsDisplay.setMap(self.instance);
      self.directionsInfoWindow.setContent(content);
      self.directionsInfoWindow.open(self.instance, marker);
      self.callbacks.showcaseMarkersInfos(marker.pairedCoordinates, travelInfo);
  }

  this.directionsService.route({
    origin: this.centerMarker.position,
    destination: marker.position,
    travelMode: google.maps.TravelMode[this.options.travelMode]
  }, function (response, status) {
    if (status == google.maps.DirectionsStatus.OK && marker) {
      self.directionsDisplay.setDirections(response);
      var route = response.routes[0].legs[0];
      var travelInfo = {
        origin: self.centerMarker.position,
        travelMode: self.options.travelMode,
        distance: route.distance,
        duration: route.duration
      };

      var content = self.createInfoWindowContent(travelInfo);
      self.directionsDisplay.setMap(self.instance);
      self.directionsInfoWindow.setContent(content);
      self.directionsInfoWindow.open(self.instance, marker);
      self.callbacks.showcaseMarkersInfos(marker.pairedCoordinates, travelInfo);
      self.cachedTravelInfos[self.options.travelMode][marker.pairedCoordinates] = travelInfo;
    }
  });
}

CommuteMap.prototype.createInfoWindowContent = function(travelInfo) {
  var icon = '';
  switch (travelInfo.travelMode) {
    case 'DRIVING': icon = 'fa fa-car'; break;
    case 'TRANSIT': icon = 'fa fa-train'; break;
    case 'WALKING': icon = 'fa fa-male'; break;
    case 'BICYCLING': icon = 'fa fa-bicycle'; break;
  }
  return '<i class="' + icon + '"></i> <b>' + travelInfo.duration.text + '</b>';
}

CommuteMap.prototype.hideRoute = function() {
  this.directionsDisplay.setMap(null);
  this.directionsInfoWindow.close();
}

CommuteMap.prototype.addShowcaseMarker = function(marker) {
  var self = this;
  this.showcaseMarkers[marker._id] = marker;
  // wait for other markers before calling getMarkerInfosMatrix
  if (!this.getMarkerInfosMatrixCalled) {
    this.getMarkerInfosMatrixCalled = true;
    _.delay(function() {
      self.getMarkerInfosMatrix(marker);
      self.getMarkerInfosMatrixCalled = false;
    }, 200);
  }
  this.callbacks.showcaseMarkerAdded(marker);
}

CommuteMap.prototype.removeShowcaseMarkers = function(id) {
  //var self = this;
  //_.each(this.showcaseMarkers, function(marker) {
  this.callbacks.showcaseMarkerRemoved({});
  //});
  this.showcaseMarkers = {};
}

CommuteMap.prototype.removeShowcaseMarkerById = function(id) {
  this.callbacks.showcaseMarkerRemoved(this.showcaseMarkers[id]);
  delete this.showcaseMarkers[id];
}

CommuteMap.prototype.getMarkerInfosMatrix = _.debounce(function() {
  var self = this;
  // object to array
  var showcaseMarkersArray = _.map(this.showcaseMarkers, function(marker) {
    return marker;
  });
  // unique pairedCoordinates
  showcaseMarkersArray = _.uniq(showcaseMarkersArray, function(item, key, a) {
    return item.pairedCoordinates;
  });

  // reject if travel info is in cache
  if (this.cachedTravelInfos.origin === this.centerMarker.pairedCoordinates) {
    showcaseMarkersArray = _.reject(showcaseMarkersArray, function(marker) {
      var cachedTravelInfo = self.cachedTravelInfos[self.options.travelMode][marker.pairedCoordinates];
      if (cachedTravelInfo) {
        self.callbacks.showcaseMarkersInfos(marker.pairedCoordinates, cachedTravelInfo);
        return true;
      }
      return false;
    });
    if (showcaseMarkersArray.length == 0) {
      return;
    }
  } else {
    // clear cache (because a different origin is requested)
    this.cachedTravelInfos = {
      origin: this.centerMarker.pairedCoordinates,
      'DRIVING': {},
      'TRANSIT': {},
      'WALKING': {},
      'BICYCLING': {}
    };
  }

  // get travel infos from google matrix service
  this.distanceMatrixService.getDistanceMatrix({
    origins: [this.centerMarker.position],
    destinations: _.map(showcaseMarkersArray, function(marker) {
      return new google.maps.LatLng(marker.position.coordinates[1], marker.position.coordinates[0]);
    }),
    travelMode: google.maps.TravelMode[this.options.travelMode]
  }, function (response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      var results = response.rows[0].elements;
      for (var j = 0; j < results.length; j++) {
        if (results[j].status !== 'OK') {
          continue;
        }

        var travelInfo = {
          origin: self.centerMarker.position,
          travelMode: self.options.travelMode,
          distance: results[j].distance,
          duration: results[j].duration
        };
        self.callbacks.showcaseMarkersInfos(showcaseMarkersArray[j].pairedCoordinates, travelInfo);
        // cache result
        self.cachedTravelInfos[self.options.travelMode][showcaseMarkersArray[j].pairedCoordinates] = travelInfo;
      }
    }
  });
}, 200);

CommuteMap.prototype.toggleInvertedCircleVisibility = function() {
  var visible = this.centerMarker.getVisible();
  this.setInvertedCircleVisibility(!visible);
}

CommuteMap.prototype.setInvertedCircleVisibility = function(visible, fitBounds) {
  if (this.centerMarker.getVisible() === visible) {
    return;
  }

  if (visible) {
    this.boundsMode.set('byDistance');
    if (fitBounds) {
      this.instance.fitBounds(this.centerMarker.getBounds());
    }
    this.centerMarker.triggerPositionChangedEvent();
    // zoom in if it is set to visible and clusterer is visible
    if (this.instance.getZoom() <= this.options.boundsModeZoomThreshhold) {
      this.instance.setZoom(this.options.boundsModeZoomThreshhold + 1);
    }
    this.instance.setCenter(this.centerMarker.getCenter());
  } else {
    this.boundsMode.set('byMap');
    this.callMapBoundsChanged(true);
  }
  this.centerMarker.setVisible(visible);
}

CommuteMap.prototype.setCenterByAddress = function(city, country) {
  var self = this;
  this.geocoder.geocode({
    address: city + ', ' + country
  }, function (result, status) {
    if (status != 'OK') {
      return;
    }
    result = result[0];
    self.setLocationByGeocoderResults(result);
  });
}

CommuteMap.prototype.setLocationByGeocoderResults = function(result) {
  this.deselectSelectedMarker();
  this.centerMarker.addressOverlay.close();
  this.centerMarker.setCenter(result.geometry.location, true);

  this.instance.setCenter(result.geometry.location);

  var firstAddressComponentTypes = result.address_components[0].types;
  if (firstAddressComponentTypes.indexOf('street_number') !== -1) {
    this.instance.setZoom(17);
  } else if (firstAddressComponentTypes.indexOf('route') !== -1) {
    this.instance.setZoom(16);
  } else if (firstAddressComponentTypes.indexOf('sublocality_level_3') !== -1) {
    this.instance.setZoom(15);
  } else if (firstAddressComponentTypes.indexOf('sublocality_level_2') !== -1) {
    this.instance.setZoom(14);
  } else if (firstAddressComponentTypes.indexOf('postal_code') !== -1) {
    this.instance.setZoom(14);
  } else {
    this.instance.setZoom(13);
  }

  this.centerMarker.triggerPositionChangedEvent(true);
  var locality = _.find(result.address_components, function(addressComponent) {
    return addressComponent.types.indexOf('locality') !== -1;
  });
  var country = _.find(result.address_components, function(addressComponent) {
    return addressComponent.types.indexOf('country') !== -1;
  });
  if (locality) {
    this.callbacks.locationChanged(locality.short_name, country.short_name);
  }
}