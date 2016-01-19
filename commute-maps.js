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
    _.each(this.utilityLibraries, function(path) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = path;

      document.body.appendChild(script);
    });
    InitGeocomplete();
    LoadMarkerWithLabel();
    LoadMarkerClusterer();
    InitInvertedCircle();
    this._loaded.set(true);
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
      options.collection,
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
      zoomControl: true,
      zoomControlOptions: {
          position: google.maps.ControlPosition.LEFT_CENTER
      },
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
      features: options.features,
      collection: options.collection
    });
  }
}

Template.commuteMaps.onCreated(function() {
  this.initialized = new ReactiveVar(false);
})
Template.commuteMaps.onRendered(function() {
  if (! this.data.name) {
    throw new Meteor.Error("CommuteMaps - Missing argument: name");
  }

  var self = this;
  var initCommuteMaps = function() {
    var canvas = document.getElementById('map-' + self.data.name);
      self._map = CommuteMaps.create({
        name: self.data.name,
        element: canvas,
        options: self.data.options,
        callbacks: self.data.callbacks,
        features: self.data.features,
        collection: self.data.collection
      });

      // set commute box depending on options
      var travelMode = self._map.getTravelMode();
      $('a[data-travel-mode="' + travelMode + '"]').addClass('active');
      self.initialized.set(true);
  }

  self.autorun(function(runFunc) {
    // Check if CommuteMaps has loaded
    if (CommuteMaps.loaded()) {
      if (CommuteMaps.get(self.data.name)) {
        throw new Meteor.Error("CommuteMaps - Name already exists");
      }
      if (!_.isObject(self.data.options)) {
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

      if (self.data.labels) {
        self.data.options.enterAddressLabel = self.data.labels.enterAddressLabel;
      }

      if (self.data.options.center &&
        self.data.options.center.city &&
        self.data.options.center.country) {
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({
          address: self.data.options.center.city + ', ' + self.data.options.center.country
        }, function (res, status) {
          if (status != 'OK') {
            return;
          }
          var location = res[0].geometry.location;
          self.data.options.center = {
            lat: location.lat(),
            lng: location.lng()
          }
          initCommuteMaps();
        });
      } else {
        initCommuteMaps();
      }

      runFunc.stop();
    }
  });

  var oldData = {
    options: self.data.options,
    labels: self.data.labels
  };

  self.autorun(function(runFunc) {
    if (self.initialized.get()) {
      // call it to react to dependencies
      var data = Template.currentData();

      if (!_.isEqual(data.options.showcaseQuery, oldData.options.showcaseQuery)) {
        self._map.options.showcaseQuery = data.options.showcaseQuery;
        self._map.startObservingShowcase();
        oldData.options.showcaseQuery = data.options.showcaseQuery;
      }

      if (data.options.styles &&
        !_.isEqual(data.options.styles, oldData.options.styles)) {
        self._map.instance.setOptions({styles: data.options.styles});
        oldData.options.styles = data.options.styles;
      }

      // labels
      if (!_.isEqual(data.labels, oldData.labels)) {
        self._map.centerMarker.set('enterAddressLabel', data.labels.enterAddressLabel);
        oldData.labels = data.labels;
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
    CommuteMaps.maps[this.data.name].destroy();
    delete CommuteMaps.maps[this.data.name];
  }
});

Template.commuteMaps.helpers({
  travelModesLabel: function() {
    // Default label
    if (!this.labels || typeof this.labels.travelModesLabel === 'undefined') {
      return 'Travel Modes';
    }
    return this.labels.travelModesLabel;
  },
  showAllMarkersLabel: function() {
    // Default label
    if (!this.labels || typeof this.labels.showAllMarkersLabel === 'undefined') {
      return 'Show All Markers';
    }
    return this.labels.showAllMarkersLabel;
  },
  toggleInvertedCircleLabel: function() {
    // Default label
    if (!this.labels || typeof this.labels.toggleInvertedCircleLabel === 'undefined') {
      return 'Distance';
    }
    return this.labels.toggleInvertedCircleLabel;
  },
  isInvertedCircleVisible: function() {
    var instance = Template.instance();
    if (instance.initialized.get()) {
      return instance._map.boundsMode.get() === 'byDistance';
    }
  }
});

Template.commuteMaps.events({
  'click .showAllMarkers': function(e, t) {
    t._map.callbacks.showHiddenMarkersChanged(e.target.checked);
    if (t.data.options.useGoogleAnalytics) {
      ga('send', 'event', 'Site: Search', 'Show All Markers');
    }
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
    if (t.data.options.useGoogleAnalytics) {
      ga('send', 'event', 'Site: Search', 'Data travel mode clicked', travelMode)
    }
  },
  'click .invertedCircleToggle': function(e, t) {
    t._map.toggleInvertedCircleVisibility();
    if (t.data.options.useGoogleAnalytics) {
      ga('send', 'event', 'Site: Search', 'User toggled Inverted Circle ');
    }
  },
  'click .refreshCenter': function(e, t) {
    t._map.setCenterToMapCenter();
  }
});