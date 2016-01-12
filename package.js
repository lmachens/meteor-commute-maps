Package.describe({
  name: 'lmachens:commute-maps',
  version: '0.0.3',
  // Brief, one-line summary of the package.
  summary: '',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use([
    'ecmascript',
    'templating',
    'twbs:bootstrap',
    'reactive-var',
    'underscore',
    'postrednik:meteor-rangeslider'
    ]);
  api.addFiles([
   'lib/markerwithlabel.js',
   'lib/markerclusterer.js',
   'lib/jquery.geocomplete.js',
   'lib/google-maps-inverted-circle.js',
   'commute-maps.html',
   'commute-maps.css',
   'commute-maps.js',
   'commute-map.js'
  ], 'client');
  api.addAssets([
   'images/clusterer.png',
   'images/clusterer_active.png',
   'images/clusterer_highlighted.png',
   'images/center.png',
   'images/resize_leftright.png'
  ], 'client');
  api.export([
    'CommuteMaps',
    'CommuteMap',
    'LoadMarkerWithLabel',
    'LoadMarkerClusterer'
  ], 'client');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('lmachens:commute-maps');
  api.addFiles('commute-maps-tests.js');
});
