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
  },
  create: function(options) {
    if (!_.isArray(options.options)) {
      options.options = [];
    }
    _.defaults(options.options, {
      zoom: 12,
      center: {lat: 52.5167, lng: 13.3833},
      zoomControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      panControl: false
    });

    this._create(options.name, {
      instance: new google.maps.Map(options.element, options.options),
      options: options.options
    });
  }
}


Template.commuteMaps.onRendered(function() {
  var self = this;
  self.autorun(function(runFunc) {
    // Check if CommuteMaps has loaded
    if (CommuteMaps.loaded()) {
      var data = Template.currentData();

      if (! data.name) {
        throw new Meteor.Error("CommuteMaps - Missing argument: name");
      }

      self._name = data.name;

      var canvas = document.getElementById('map-' + data.name);

      CommuteMaps.create({
        name: data.name,
        element: canvas,
        options: data.options
      });

      runFunc.stop();
    }
  });
});

Template.commuteMaps.onDestroyed(function() {
  if (CommuteMaps[this._name]) {
    google.maps.event.clearInstanceListeners(CommuteMaps.maps[this._name].instance);
    delete CommuteMaps.maps[this._name];
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
  'click .zoom .in': function (e, t) {
    CommuteMaps.get(t.data.name).zoomIn();
  },
  'click .zoom .out': function (e, t) {
    CommuteMaps.get(t.data.name).zoomOut();
  }
});