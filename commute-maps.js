CommuteMaps = {
  // Loads Maps once
  load: _.once(function(options) {
    options = _.extend({ v: '3.exp' }, options);
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
      options.options
    );

    google.maps.event.addListener(options.instance, 'tilesloaded', function() {
      self._ready(name, self.maps[name]);
    });
    return self.maps[name];
  },
  create: function(options) {
    _.defaults(options.options, {
      zoom: 12,
      center: {lat: 52.5167, lng: 13.3833},
      zoomControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      panControl: false
    });

    return this._create(options.name, {
      instance: new google.maps.Map(options.element, options.options),
      options: options.options
    });
  }
}


Template.commuteMaps.onRendered(function() {
  if (! this.data.name) {
    throw new Meteor.Error("CommuteMaps - Missing argument: name");
  }

  var self = this;
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
        options: self.data.options
      });

      // observe markers collection
      Tracker.autorun(function(subRunFunc) {
        if (self._observe) {
          self._observe.stop();
        }
        self._observe = self.data.markers.observe({
          removed: function (marker) {
            self._map.removeMarker(marker);
            console.log(marker);
          },
          added: function(marker, index) {
            self._map.addMarker(marker);
            console.log(marker);
          }
        });
      });

      runFunc.stop();
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
  }
});