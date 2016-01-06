CommuteMaps = {
  // Loads Maps once
  load: _.once(function(options) {
    options = _.extend({ v: '3.exp', libraries: 'places,geometry'}, options);
    var params = _.map(options, function(value, key) { return key + '=' + value; }).join('&');
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://maps.googleapis.com/maps/api/js?' + params +
      '&callback=CommuteMaps.initialize';
    document.body.appendChild(script);
  }),
  utilityLibraries: [],
  loadUtilityLibrary: function(path) {
    this.utilityLibraries.push(path);
  },
  _loaded: new ReactiveVar(false),
  loaded: function() {
    return this._loaded.get();
  },
  maps: {},
  _callbacks: {},
  initialize: function() {
    this._loaded.set(true);
    _.each(this.utilityLibraries, function(path) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = path;

      document.body.appendChild(script);
    });
    LoadMarkerWithLabel();
    LoadMarkerClusterer();
    InitInvertedCircle();
  },
  _ready: function(name, map) {
    _.each(this._callbacks[name], function(cb) {
      if (_.isFunction(cb)) {
        cb(map);
      }
    });
  },
  ready: function(name, cb) {
    if (! this._callbacks[name]) {
      this._callbacks[name] = [];
    }
    // make sure we run the callback only once
    // as the tilesloaded event will also run after initial load
    this._callbacks[name].push(_.once(cb));
  },
  get: function(name) {
    return this.maps[name];
  },
  _create: function(name, options) {
    var self = this;
    self.maps[name] = new CommuteMap (
      options.instance,
      options.options,
      options.callbacks,
      options.features
    );

    google.maps.event.addListener(options.instance, 'tilesloaded', function() {
      self._ready(name, self.maps[name]);
    });
    return self.maps[name];
  },
  create: function(options) {
    _.defaults(options.options, {
      zoom: 12,
      minZoom: 9,
      maxZoom: 18,
      center: {lat: 52.5167, lng: 13.3833},
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      zoomControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      panControl: false,
      styles: [
        {
          'featureType': 'landscape',
          'elementType': 'labels',
          'stylers': [
            {
              'visibility': 'off'
            }
          ]
        }, {
          'featureType': 'poi',
          'elementType': 'labels',
          'stylers': [
            {
              'visibility': 'off'
            }
          ]
        }, {
          'featureType': 'road',
          'elementType': 'geometry',
          'stylers': [
            {
              'lightness': 57
            }
          ]
        }, {
          'featureType': 'road',
          'elementType': 'labels.text.fill',
          'stylers': [
            {
              'visibility': 'on'
            }, {
              'lightness': 24
            }
          ]
        }, {
          'featureType': 'road',
          'elementType': 'labels.icon',
          'stylers': [
            {
              'visibility': 'off'
            }
          ]
        }, {
          'featureType': 'water',
          'elementType': 'labels',
          'stylers': [
            {
              'visibility': 'off'
            }
          ]
        }
      ]
    });

    return this._create(options.name, {
      instance: new google.maps.Map(options.element, options.options),
      center: options.center,
      options: options.options,
      callbacks: options.callbacks,
      features: options.features
    });
  }
}

Template.commuteMaps.onRendered(function() {
  if (! this.data.name) {
    throw new Meteor.Error("CommuteMaps - Missing argument: name");
  }

  var self = this;
  var initialized = new ReactiveVar(false);

  self.autorun(function(runFunc) {
    // Check if CommuteMaps has loaded
    if (CommuteMaps.loaded()) {
      if (CommuteMaps.get(self.data.name)) {
        throw new Meteor.Error("CommuteMaps - Name already exists");
      }
      if (!_.isArray(self.data.options)) {
        self.data.options = {};
      }
      // open last active tab
      if (Session.get(self.data.name + '-boundsMode') == 'time') {
        $('.nav-tabs a[href="#byTravelTime-' + self.data.name + '"]').tab('show');
        self.data.options.commuteMode = 'byTime';
      } else {
        $('.nav-tabs a[href="#byDistance-' + self.data.name + '"]').tab('show');
        self.data.options.commuteMode = 'byDistance';
      }

      var canvas = document.getElementById('map-' + self.data.name);

      self._map = CommuteMaps.create({
        name: self.data.name,
        element: canvas,
        options: self.data.options,
        callbacks: self.data.callbacks,
        features: self.data.features,
        highlightedMarkers: self.data.highlightedMarkers
      });

      // set commute box depending on options
      var travelMode = self._map.getTravelMode();
      $('a[data-travel-mode="' + travelMode + '"]').addClass('active');

      initialized.set(true);
      runFunc.stop();
    }
  });

  var oldData = {
    markers: null,
    showcaseMarkers: null,
    highlightedMarkers: null
  };

  self.autorun(function(runFunc) {
    if (initialized.get()) {
      // call it to react to dependencies
      var data = Template.currentData();

      if (!oldData.markers ||
        data.markers.collection.name !== oldData.markers.collection.name ||
        !_.isEqual(data.markers.matcher, oldData.markers.matcher)) {
        // observe markers collection
        if (self._observe) {
          self._observe.stop();
          // todo: remove all markers
        }
        self._observe = data.markers.observe({
          removed: function (marker) {
            self._map.removeMarker(marker);
          },
          added: function(marker, index) {
            self._map.addMarker(marker);
          }
        });
        oldData.markers = data.markers;
      }

      if (!oldData.showcaseMarkers ||
        data.showcaseMarkers.collection.name !== oldData.showcaseMarkers.collection.name ||
        !_.isEqual(data.showcaseMarkers.matcher, oldData.showcaseMarkers.matcher)) {
        // observe showcase markers
        if (self._observeShowcase) {
          self._observeShowcase.stop();
          self._map.removeShowcaseMarkers();
        }
        self._observeShowcase = data.showcaseMarkers.observeChanges({
          removed: function(id) {
            self._map.removeShowcaseMarkerById(id);
          },
          addedBefore: function(id, fields, before) {
            self._map.addShowcaseMarker(
              _.extend({_id: id}, fields)
            );
          }
        });
        oldData.showcaseMarkers = data.showcaseMarkers;
      }

      if (!oldData.highlightedMarkers ||
        data.highlightedMarkers.collection.name !== oldData.highlightedMarkers.collection.name ||
        !_.isEqual(data.highlightedMarkers.matcher, oldData.highlightedMarkers.matcher)) {
        // observe highlighted markers
        if (self._observeHighlighted) {
          self._observeHighlighted.stop();
          // todo delete
        }
        self._observeHighlighted = data.highlightedMarkers.observe({
          removed: function (marker) {
            self._map.lowlightMarkerByCoordinates(marker.pairedCoordinates);
          },
          added: function(marker, index) {
            self._map.highlightMarkerByCoordinates(marker.pairedCoordinates);
          }
        });
        oldData.highlightedMarkers = data.highlightedMarkers;
      }
    }

  });

  var rangeSliderValue = Session.get(this.data.name + '-rangeSliderValue');
  $('#byTimeMinutes-' + this.data.name).ionRangeSlider({
    min: 5,
    max: 60,
    from: rangeSliderValue ? rangeSliderValue : 20,
    prefix: 'bis ',
    postfix: ' Minuten',
    hide_min_max: true,
    grid: false,
    onFinish: function (data) {
      Session.set(self.data.name + '-rangeSliderValue', data.from);
    }
  });
});

Template.commuteMaps.onDestroyed(function() {
  if (this._map) {
    google.maps.event.clearInstanceListeners(CommuteMaps.maps[this.data.name].instance);
    delete CommuteMaps.maps[this.data.name];
  }
  if (this._observe) {
    this._observe.stop();
  }
  if (this._observeShowcase) {
    this._observeShowcase.stop();
  }

  if (this._observeHighlighted) {
    this._observeHighlighted.stop();
  }
});

Template.commuteMaps.helpers({
  byDistanceLabel: function() {
    // Default label
    if (!this.labels || typeof this.labels.byDistanceLabel === 'undefined') {
      return 'By Distance';
    }
    return this.labels.byDistanceLabel;
  },
  byTravelTimeLabel: function() {
    // Default label
    if (!this.labels || typeof this.labels.byTravelTimeLabel === 'undefined') {
      return 'By Travel Time';
    }
    return this.labels.byTravelTimeLabel;
  },
  showAllMarkersLabel: function() {
    // Default label
    if (!this.labels || typeof this.labels.showAllMarkersLabel === 'undefined') {
      return 'Show All Markers';
    }
    return this.labels.showAllMarkersLabel;
  }
});

Template.commuteMaps.events({
  'click .zoomControls .in': function (e, t) {
    t._map.zoomIn();
  },
  'click .zoomControls .out': function (e, t) {
    t._map.zoomOut();
  },
  'click .showAllMarkers': function(e, t) {
    t._map.callbacks.showHiddenMarkersChanged(e.target.checked);
  },
  'click a[data-travel-mode]': function (e, t) {
    $('a[data-travel-mode]').each(function() {
      $(this).removeClass('active');
    });
    $(e.currentTarget).addClass('active');
    //$(e.currentTarget).toggleClass('active');
    var travelMode = $(e.currentTarget).data('travel-mode');
    var isActive = $(e.currentTarget).hasClass('active');
    t._map.setTravelMode(travelMode);
    e.currentTarget.blur();
  }
});