window.InitInvertedCircle = function() {
  /*
  * https://github.com/lmachens/google-maps-inverted-circle
  * Copyright (c) 2013 Miah Raihan Mahmud Arman
  * Copyright (c) 2015 Leon Machens
  * Released under the MIT licence: http://opensource.org/licenses/mit-license
  * Note: The Google Maps API v3 must be included *before* this code
  */

  function InvertedCircle(opts) {
    var options = {
      visible: true,
      centerVisible: true,
      map: opts.map,
      center: opts.map.getCenter(),
      radius: 200000, // 200 km
      draggable: false,
      editable: false,
      stroke_weight: 1,
      stroke_color: '#000',
      fill_opacity: 0.3,
      fill_color: "#000",
      always_fit_to_map: false,
      radius_style: "background: #fff; border: 1px solid black; position: absolute;",
      position_changed_event: function() {},
      radius_changed_event: function() {},
      center_clicked_event: function() {},
      clicked_event: function() {},
      locationChanged: function() {},
      enterAddressLabel: 'Enter Address',
      defaultZoom: 13
    }
    options = this.extend_(options, opts);
    this.set('visible', options.visible);
    this.set('centerVisible', options.centerVisible);
    if (!options.visible)
      options.editable = false;
    this.set('map', options.map);
    this.set('center', options.center);
    this.set('radius', options.radius);
    this.set('old_radius', options.radius);
    this.set('draggable', options.draggable);
    this.set('editable', options.editable);
    this.set('stroke_weight', options.stroke_weight);
    this.set('stroke_color', options.stroke_color);
    this.set('fill_opacity', options.fill_opacity);
    this.set('fill_color', options.fill_color);
    this.set('always_fit_to_map', options.always_fit_to_map);
    this.set('position', options.center);
    this.set('resize_leftright', options.resize_leftright);
    this.set('resize_updown', options.resize_updown);
    this.set('center_icon', options.center_icon);
    this.set('position_changed_event', options.position_changed_event);
    this.set('radius_changed_event', options.radius_changed_event);
    this.set('center_clicked_event', options.center_clicked_event);
    this.set('locationChanged', options.locationChanged);
    this.set('clicked_event', options.clicked_event);
    this.set('enterAddressLabel', options.enterAddressLabel);
    this.set('defaultZoom', options.defaultZoom);

    // Add a text overlay for the radius
    this.radiusOverlay = new google.maps.InfoWindow();
    this.addressOverlay = new google.maps.InfoWindow();

    // Add the center marker
    this.addCenter_();

    // Draw the inverse circle
    this.drawCircle_(this.get('map'), this.get('position'), this.get('radius') / 1000);

    // Add the sizer marker
    this.addSizer_();

    // force address window always on top
    google.maps.event.addListener(this.addressOverlay, 'domready', function() {
        this.setZIndex(google.maps.Marker.MAX_ZINDEX);
    });
    this.geocoder = new google.maps.Geocoder();
    // hide x-button in infoWindow (not the best solution..)
    /*google.maps.event.addListener(this.radiusOverlay, 'domready', function() {
      $(".gm-style-iw").next("div").hide();
    });*/
    //this.addVisibleController_();
    var me = this;
    google.maps.event.addListenerOnce(options.map, 'idle', function(){
      me.openAddressOverlay();
    });

    this.animate();
  }

  InvertedCircle.prototype = new google.maps.MVCObject();

  InvertedCircle.prototype.position_changed = function()
  {
    this.set('center', this.get('position'));
    if(this.get('donut')){
      var paths = new this.Overlay;
      var spot = this.drawSpot_(this.getCenter(), this.getRadius() / 1000);
      for (var i = 0; i < spot.length; i++) {
        paths.push(spot[i]);
      }
      this.set('paths', paths);
      if(this.getVisible())
        this.get('donut').setPaths(paths);
    }
    if(this.get('sizer_left') && this.get('sizer_right') && this.get('sizer_up') && this.get('sizer_down')){
      var left_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), -90);
      var right_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 90);
      var up_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 360);
      var down_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 180);
      this.get('sizer_left').setPosition(left_endpoint);
      this.get('sizer_right').setPosition(right_endpoint);
      this.get('sizer_up').setPosition(up_endpoint);
      this.get('sizer_down').setPosition(down_endpoint);
    }
  };

  InvertedCircle.prototype.radius_changed = function()
  {
    if(this.get('donut')){
      var paths = new this.Overlay;
      var spot = this.drawSpot_(this.getCenter(), this.getRadius() / 1000);
      for (var i = 0; i < spot.length; i++) {
        paths.push(spot[i]);
      }
      this.set('paths', paths);
      if(this.getVisible())
        this.get('donut').setPaths(paths);
    }
    if(this.get('sizer_left') && this.get('sizer_right') && this.get('sizer_up') && this.get('sizer_down')){
      var left_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), -90);
      var right_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 90);
      var up_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 360);
      var down_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 180);
      this.get('sizer_left').setPosition(left_endpoint);
      this.get('sizer_right').setPosition(right_endpoint);
      this.get('sizer_up').setPosition(up_endpoint);
      this.get('sizer_down').setPosition(down_endpoint);
    }
  };

  InvertedCircle.prototype.visible_changed = function()
  {
    var visible = this.getVisible();
    this.setEditable(visible);
    //this.setDraggable(this.getVisible());
    if(visible){
      if(this.get('donut'))
        this.get('donut').setPaths(this.get('paths'));
    } else{
      if(this.get('donut'))
        this.get('donut').setPaths([]);
    }

  }

  InvertedCircle.prototype.centerVisible_changed = function()
  {
    if (this.get('center_marker'))
      this.get('center_marker').setVisible(this.get('centerVisible'));
  }

  InvertedCircle.prototype.setMap = function(map)
  {
    this.set('map', map);
  }

  InvertedCircle.prototype.getMap = function()
  {
    return this.get('map');
  }

  InvertedCircle.prototype.setVisible = function(visible)
  {
    this.set('visible', visible);
  /*if(this.get('visible')){
        this.get('circleControlDiv').innerHTML = '<div style="direction: ltr; overflow: hidden; text-align: left; position: relative; color: rgb(0, 0, 0); font-family: Arial, sans-serif; -webkit-user-select: none; font-size: 13px; background-color: rgb(255, 255, 255); padding: 4px; border-width: 1px 1px 1px 0px; border-top-style: solid; border-right-style: solid; border-bottom-style: solid; border-top-color: rgb(113, 123, 135); border-right-color: rgb(113, 123, 135); border-bottom-color: rgb(113, 123, 135); -webkit-box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; font-weight: bold; background-position: initial initial; background-repeat: initial initial; " title="Turn On/Off the Circle"><span><div style="width: 16px; height: 16px; overflow: hidden; position: relative; "><img style="position: absolute; left: 0px; top: 0px; -webkit-user-select: none; border: 0px; padding: 0px; margin: 0px; width: auto; height: auto; " src="http://maps.gstatic.com/mapfiles/drawing.png" draggable="false"></div></span></div>';
      }else{
        this.get('circleControlDiv').innerHTML = '<div style="direction: ltr; overflow: hidden; text-align: left; position: relative; color: rgb(51, 51, 51); font-family: Arial, sans-serif; -webkit-user-select: none; font-size: 13px; background-color: rgb(255, 255, 255); padding: 4px; border-width: 1px 1px 1px 0px; border-top-style: solid; border-right-style: solid; border-bottom-style: solid; border-top-color: rgb(113, 123, 135); border-right-color: rgb(113, 123, 135); border-bottom-color: rgb(113, 123, 135); -webkit-box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; font-weight: normal; background-position: initial initial; background-repeat: initial initial; " title="Turn On/Off the Circle"><span><div style="width: 16px; height: 16px; overflow: hidden; position: relative; "><img style="position: absolute; left: 0px; top: -160px; -webkit-user-select: none; border: 0px; padding: 0px; margin: 0px; width: auto; height: auto; " src="http://maps.gstatic.com/mapfiles/drawing.png" draggable="false"></div></span></div>';
      }*/
  };

  InvertedCircle.prototype.getVisible = function()
  {
    return this.get('visible');
  };

  InvertedCircle.prototype.setCenter = function(center)
  {
    this.set('position', center);
  };

  InvertedCircle.prototype.triggerPositionChangedEvent = function(deselectMarker) {
    this.get('position_changed_event').call(this, this.get('position'), deselectMarker);
  }

  InvertedCircle.prototype.getCenter = function()
  {
    return this.get('position');
  };

  InvertedCircle.prototype.getRadius = function()
  {
    return this.get('radius');
  };

  InvertedCircle.prototype.setRadius = function(radius)
  {
    this.set('radius', radius);
  };

  InvertedCircle.prototype.getOldRadius = function()
  {
    return this.get('old_radius');
  };

  InvertedCircle.prototype.setOldRadius = function(radius)
  {
    this.set('old_radius', radius);
  };


  InvertedCircle.prototype.getEditable = function()
  {
    return this.get('editable');
  };

  InvertedCircle.prototype.setEditable = function(editable)
  {
    this.set('editable', editable);
  };

  InvertedCircle.prototype.getDraggable = function()
  {
    return this.get('draggable');
  };

  InvertedCircle.prototype.setDraggable = function(draggable)
  {
    this.set('draggable', draggable);
  };

  InvertedCircle.prototype.getBounds = function()
  {
    var old_radius = this.getOldRadius();
    var radius = this.getRadius();
    //console.log(old_radius);
    //console.log(radius);
    var bound_radius, center, bounds, left_bound, right_bound, up_bound, down_bound;
    center = this.getCenter();
    bounds = new google.maps.LatLngBounds();
    if(old_radius < radius){
      //console.log('old_radius < radius');
      bound_radius = radius;// * 1.1;
      if(bound_radius > (6371 * 1000)){
        bound_radius = 6371 * 1000;
      }
      //console.log('bound_radius = ' + bound_radius);
      left_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, -90);
      right_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 90);
      up_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 360);
      down_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 180);
    }
    if(old_radius > radius){
      //console.log('old_radius > radius');
      bound_radius = radius;// / 2.5;
      if(bound_radius < 0){
        bound_radius = 0;
      }
      //console.log('bound_radius = ' + bound_radius);
      left_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, -90);
      right_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 90);
      up_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 360);
      down_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 180);
    }

    if(old_radius == radius){
      //console.log('old_radius == radius');
      bound_radius = radius;
      left_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, -90);
      right_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 90);
      up_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 360);
      down_bound = google.maps.geometry.spherical.computeOffset(center, bound_radius, 180);
    }

    /*console.log(left_bound);
      console.log(right_bound);
      console.log(up_bound);
      console.log(down_bound);*/

    bounds.extend(left_bound);
    bounds.extend(right_bound);
    bounds.extend(up_bound);
    bounds.extend(down_bound);

    /*var bounds = new google.maps.LatLngBounds();
      bounds.extend(this.get('sizer_left').getPosition());
      bounds.extend(this.get('sizer_right').getPosition());
      bounds.extend(this.get('sizer_up').getPosition());
      bounds.extend(this.get('sizer_down').getPosition());*/
    return bounds;
  };

  /**
    * Add the center marker to the map.
    *
    * @private
    */
  InvertedCircle.prototype.addCenter_ = function() {
    var me = this;
    var center_marker = new google.maps.Marker({
      position: this.getCenter(),
      //title: 'Drag me!',
      raiseOnDrag: false,
      zIndex: google.maps.Marker.MAX_ZINDEX -1,
      visible: this.get('centerVisible')
    });
    var position = center_marker.getPosition();
    this.pairedCoordinates = position.lat() * 1e7 << 16 & 0xffff0000 | position.lng() * 1e7 & 0x0000ffff;

    center_marker.addListener('click', function() {
      me.addressOverlay.setContent(
        '<form id="addressForm" style="width: 230px">' +
        '<div class="input-group">' +
        '<input class="form-control" placeholder="' + me.get('enterAddressLabel') + '">' +
        '<span class="input-group-btn" id="submitAddress">' +
        '<button type="submit" class="btn btn-secondary" type="button"><i class="fa fa-search"></i></button>' +
        '</span>' +
        '</div>' +
        '</form>'
      );
      me.addressOverlay.open(me.get('map'), center_marker);
      $('#addressForm input').geocomplete().bind(
        'geocode:result',
        function (e, result) {
          me.get('locationChanged')(result);
        }
      );
      $('#addressForm button[type=submit]').click(function() {
        $('#addressForm input').trigger("geocode");
      });
      $('#addressForm input').focus();
    });

    this.get('map').addListener('click', function() {
      me.addressOverlay.close();
    });

    var center_icon = this.get('center_icon');
    if (center_icon) {
      if (typeof center_icon === 'string') {
        center_icon = {
          url: this.get('center_icon'),
          size: new google.maps.Size(29, 29),
          origin: new google.maps.Point(0,0),
          anchor: new google.maps.Point(15, 15)
        }
      }
      center_marker.setIcon(center_icon);
      google.maps.event.addListener(center_marker, 'mouseover', function() {
        var icon = center_marker.getIcon();
        icon.origin = new google.maps.Point(0, icon.size.height);
        center_marker.setIcon(icon);
      });
      google.maps.event.addListener(center_marker, 'mouseout', function() {
        var icon = center_marker.getIcon();
        icon.origin = new google.maps.Point(0,0);
        center_marker.setIcon(icon);
      });
    }

    // Bind the marker map property to the InvertedCircle map property
    center_marker.bindTo('map', this);
    center_marker.bindTo('draggable', this);

    // Bind the marker position property to the InvertedCircle position property
    center_marker.bindTo('position', this);
    this.set('center_marker', center_marker);

    var me = this;
    google.maps.event.addListener(center_marker, 'drag', function() {
      var position = center_marker.getPosition();
      me.setCenter(position);
      //me.pairedCoordinates = position.lat() * 1e7 << 16 & 0xffff0000 | position.lng() * 1e7 & 0x0000ffff;
    });

    google.maps.event.addListener(center_marker, 'dragend', function() {
      var position = center_marker.getPosition();
      me.pairedCoordinates = position.lat() * 1e7 << 16 & 0xffff0000 | position.lng() * 1e7 & 0x0000ffff;
      me.get('position_changed_event').call(me, position);
      /*if(me.get('always_fit_to_map')){
        me.get('map').fitBounds(me.getBounds());
      }*/
      me.get('map').setCenter(me.getCenter());
    });
  }

  InvertedCircle.prototype.animate = function() {
    var center_marker = $('img[src^="' + this.get('center_icon').url + '"]').css([
      '-webkit-animation: pulse 1s ease 1s 3',
      '-moz-animation: pulse 1s ease 1s 3',
      'animation: pulse 1s ease 1s 3'
    ]);

  }

  InvertedCircle.prototype.openAddressOverlay = function() {
    google.maps.event.trigger(this.center_marker, 'click');
  }

  InvertedCircle.prototype.closeAddressOverlay = function() {
    this.addressOverlay.close();
  }

  /**
    * Add the sizer markers to the map.
    *
    * @private
    */
  InvertedCircle.prototype.addSizer_ = function() {
    var left_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), -90);
    var sizer_left = new google.maps.Marker({
      position: left_endpoint,
      //title: 'Drag me!',
      raiseOnDrag: false,
      zIndex: 9999999
    });

    var right_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 90);
    var sizer_right = new google.maps.Marker({
      position: right_endpoint,
      //title: 'Drag me!',
      raiseOnDrag: false,
      zIndex: 9999999
    });

    var up_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 360);
    var sizer_up = new google.maps.Marker({
      position: up_endpoint,
      //title: 'Drag me!',
      raiseOnDrag: false,
      visible: false,
      zIndex: 9999999
    });

    var down_endpoint = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 180);
    var sizer_down = new google.maps.Marker({
      position: down_endpoint,
      //title: 'Drag me!',
      raiseOnDrag: false,
      visible: false,
      zIndex: 9999999
    });

    sizer_left.bindTo('map', this, 'map');
    sizer_left.bindTo('visible', this, 'editable');
    sizer_left.bindTo('draggable', this, 'editable');
    sizer_right.bindTo('map', this, 'map');
    sizer_right.bindTo('visible', this, 'editable');
    sizer_right.bindTo('draggable', this, 'editable');
    sizer_up.bindTo('map', this, 'map');
    sizer_up.bindTo('draggable', this, 'editable');
    sizer_down.bindTo('map', this, 'map');
    sizer_down.bindTo('draggable', this, 'editable');

    this.set('sizer_left', sizer_left);
    this.set('sizer_right', sizer_right);
    this.set('sizer_up', sizer_up);
    this.set('sizer_down', sizer_down);

    var me = this;
    var resize_leftright = this.get('resize_leftright');
    if (resize_leftright) {
      var sizer_icon_left_right;
      if (typeof resize_leftright === 'string') {
        sizer_icon_left_right = {
          url: this.get('resize_leftright'),
          size: new google.maps.Size(29, 29),
          origin: new google.maps.Point(0,0),
          anchor: new google.maps.Point(15, 15)
        }
      } else {
        sizer_icon_left_right = resize_leftright
      }

      sizer_left.setIcon(sizer_icon_left_right);
      google.maps.event.addListener(sizer_left, 'mouseover', function() {
        var icon = sizer_left.getIcon();
        icon.origin = new google.maps.Point(0, icon.size.height);
        sizer_left.setIcon(icon);
        me.radiusOverlay.open(me.get('map'), sizer_left);
        me.showRadius_(sizer_left);
      });

      google.maps.event.addListener(sizer_left, 'mouseout', function() {
        if (me.dragStarted) {
          return;
        }
        var icon = sizer_left.getIcon();
        icon.origin = new google.maps.Point(0, 0);
        sizer_left.setIcon(icon);
        me.radiusOverlay.close();
      });
      // change URL of right marker to make a unique css selctor img[src="/example.png#right"]
      sizer_icon_left_right.url += '#right';
      sizer_right.setIcon(sizer_icon_left_right);
      google.maps.event.addListener(sizer_right, 'mouseover', function() {
        var icon = sizer_right.getIcon();
        icon.origin = new google.maps.Point(0, icon.size.height);
        sizer_right.setIcon(icon);
        me.radiusOverlay.open(this.get('map'), sizer_right);
        me.showRadius_(sizer_right);
      });

      google.maps.event.addListener(sizer_right, 'mouseout', function() {
        if (me.dragStarted) {
          return;
        }
        var icon = sizer_right.getIcon();
        icon.origin = new google.maps.Point(0,0);
        sizer_right.setIcon(icon);
        me.radiusOverlay.close();
      });
    }

    google.maps.event.addListener(sizer_left, 'dragstart', function() {
      me.setOldRadius(me.getRadius());
      me.dragStarted = true;

    });

    google.maps.event.addListener(sizer_right, 'dragstart', function() {
      me.setOldRadius(me.getRadius());
      me.dragStarted = true;

    });

    google.maps.event.addListener(sizer_left, 'drag', function() {
      var radius = google.maps.geometry.spherical.computeDistanceBetween(me.getCenter(), sizer_left.getPosition());
      if (radius < 500) {
        radius = 500;
      } else if (radius > 5000) {
        radius = 5000;
      }
      me.setRadius(radius);
      me.showRadius_(sizer_left);
    });

    google.maps.event.addListener(sizer_right, 'drag', function() {
      var radius = google.maps.geometry.spherical.computeDistanceBetween(me.getCenter(), sizer_right.getPosition());
      if (radius < 500) {
        radius = 500;
      } else if (radius > 5000) {
        radius = 5000;
      }
      me.setRadius(radius);
      me.showRadius_(sizer_right);
    });

    google.maps.event.addListener(sizer_left, 'dragend', function() {
      var radius = google.maps.geometry.spherical.computeDistanceBetween(me.getCenter(), sizer_left.getPosition());
      me.radiusOverlay.close();
      me.setRadius(radius);
      /*var old_radius = me.getOldRadius();
        var radius = me.getRadius();
        console.log("Old " + old_radius);
        console.log("Current " + radius);*/
      if(me.get('always_fit_to_map')){
        me.get('map').fitBounds(me.getBounds());
      }
      me.dragStarted = false;
      google.maps.event.trigger(sizer_left, 'mouseout');
      me.get('radius_changed_event').call(me, radius);
    });

    google.maps.event.addListener(sizer_right, 'dragend', function() {
      var radius = google.maps.geometry.spherical.computeDistanceBetween(me.getCenter(), sizer_right.getPosition());
      me.radiusOverlay.close();
      me.setRadius(radius);
      /*var old_radius = me.getOldRadius();
        var radius = me.getRadius();
        console.log("Old " + old_radius);
        console.log("Current " + radius);*/
      if(me.get('always_fit_to_map')){
        me.get('map').fitBounds(me.getBounds());
      }
      me.dragStarted = false;
      google.maps.event.trigger(sizer_right, 'mouseout');
      me.get('radius_changed_event').call(me, radius);
    });
  };

  InvertedCircle.prototype.showRadius_ = function(marker) {
    var contentString = parseFloat(Math.round(this.getRadius()) / 1000).toFixed(2) + ' km';
    this.radiusOverlay.setContent(contentString);
  }

  /**
    * This is to draw Circle Visible Control button
    *
    * @private
    */
  InvertedCircle.prototype.addVisibleController_ = function() {
    // Create the DIV to hold the control and call the HomeControl() constructor
    // passing in this DIV.
    this.set('circleControlDiv', document.createElement('div'));
    // Set CSS styles for the DIV containing the control
    // Setting padding to 5 px will offset the control
    // from the edge of the map.
    this.get('circleControlDiv').style.padding = '9px';
    this.get('circleControlDiv').style.cursor = 'pointer';
    this.get('circleControlDiv').innerHTML = '<div style="direction: ltr; overflow: hidden; text-align: left; position: relative; color: rgb(0, 0, 0); font-family: Arial, sans-serif; -webkit-user-select: none; font-size: 13px; background-color: rgb(255, 255, 255); padding: 4px; border-width: 1px 1px 1px 0px; border-top-style: solid; border-right-style: solid; border-bottom-style: solid; border-top-color: rgb(113, 123, 135); border-right-color: rgb(113, 123, 135); border-bottom-color: rgb(113, 123, 135); -webkit-box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; font-weight: bold; background-position: initial initial; background-repeat: initial initial; " title="Turn On/Off the Circle"><span><div style="width: 16px; height: 16px; overflow: hidden; position: relative; "><img style="position: absolute; left: 0px; top: 0px; -webkit-user-select: none; border: 0px; padding: 0px; margin: 0px; width: auto; height: auto; " src="http://maps.gstatic.com/mapfiles/drawing.png" draggable="false"></div></span></div>';
    this.get('circleControlDiv').clicked = this.get('visible');
    var $me = this;
    // Setup the click event listeners: simply set the map to Chicago.
    google.maps.event.addDomListener(this.get('circleControlDiv'), 'click', function() {
      this.clicked = !this.clicked;
      //console.log(this.clicked);
      if(this.clicked){
        this.innerHTML = '<div style="direction: ltr; overflow: hidden; text-align: left; position: relative; color: rgb(0, 0, 0); font-family: Arial, sans-serif; -webkit-user-select: none; font-size: 13px; background-color: rgb(255, 255, 255); padding: 4px; border-width: 1px 1px 1px 0px; border-top-style: solid; border-right-style: solid; border-bottom-style: solid; border-top-color: rgb(113, 123, 135); border-right-color: rgb(113, 123, 135); border-bottom-color: rgb(113, 123, 135); -webkit-box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; font-weight: bold; background-position: initial initial; background-repeat: initial initial; " title="Turn On/Off the Circle"><span><div style="width: 16px; height: 16px; overflow: hidden; position: relative; "><img style="position: absolute; left: 0px; top: 0px; -webkit-user-select: none; border: 0px; padding: 0px; margin: 0px; width: auto; height: auto; " src="http://maps.gstatic.com/mapfiles/drawing.png" draggable="false"></div></span></div>';
        $me.setVisible(true);
      }else{
        this.innerHTML = '<div style="direction: ltr; overflow: hidden; text-align: left; position: relative; color: rgb(51, 51, 51); font-family: Arial, sans-serif; -webkit-user-select: none; font-size: 13px; background-color: rgb(255, 255, 255); padding: 4px; border-width: 1px 1px 1px 0px; border-top-style: solid; border-right-style: solid; border-bottom-style: solid; border-top-color: rgb(113, 123, 135); border-right-color: rgb(113, 123, 135); border-bottom-color: rgb(113, 123, 135); -webkit-box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px; font-weight: normal; background-position: initial initial; background-repeat: initial initial; " title="Turn On/Off the Circle"><span><div style="width: 16px; height: 16px; overflow: hidden; position: relative; "><img style="position: absolute; left: 0px; top: -160px; -webkit-user-select: none; border: 0px; padding: 0px; margin: 0px; width: auto; height: auto; " src="http://maps.gstatic.com/mapfiles/drawing.png" draggable="false"></div></span></div>';
        $me.setVisible(false);
      }
    });
    this.get('circleControlDiv').index = 1;
    this.get('map').controls[google.maps.ControlPosition.LEFT_TOP].push(this.get('circleControlDiv'));
  };

  /**
    * This is to extend options
    *
    * @private
    */
  InvertedCircle.prototype.extend_ = function(obj, extObj) {
    if (arguments.length > 2) {
      for (var a = 1; a < arguments.length; a++) {
        extend(obj, arguments[a]);
      }
    } else {
      for (var i in extObj) {
        obj[i] = extObj[i];
      }
    }
    return obj;
  };

  /**
    * This is draw spots
    * Thanks Sammy Hubner (http://www.linkedin.com/in/sammyhubner) for providing me these awesome code
    * @private
    */

  InvertedCircle.prototype.drawSpot_ = function(point, radius) {
    var d2r = Math.PI / 180;   // degrees to radians
    var r2d = 180 / Math.PI;   // radians to degrees
    var earthsradius = 6371;   // 6371 is the radius of the earth in kilometers
    var ret = [];
    var isNearPrimaryMeridian = false;
    var dir = 1;
    var extp = [], start, end, i, theta, ex, ey;

    var points = 128;

    // find the radius in lat/lon
    var rlat = (radius / earthsradius) * r2d;
    var rlng = rlat / Math.cos(point.lat() * d2r);

    if (point.lng() > 0) {
      dir = -1;
    }


    if (dir==1) {
      start=0;
      end=points+1;
    } // one extra here makes sure we connect the
    else        {
      start=points+1;
      end=0;
    }
    for (i=start; (dir==1 ? i < end : i > end); i=i+dir)
    {
      theta = Math.PI * (i / (points/2));
      ex = point.lat() + (rlat * Math.sin(theta)); // center b + radius y * sin(theta)
      ey = point.lng() + (rlng * Math.cos(theta)); // center a + radius x * cos(theta)
      if ((dir === -1 && ey < 0) || (dir === 1 && ey > 0)) {
        ey = 0;
        isNearPrimaryMeridian = true;
      }
      extp.push(new google.maps.LatLng(ex, ey));
    }
    ret.push(extp);
    // if near primary meridian we have to draw an inverse
    if (isNearPrimaryMeridian) {
      extp = [];
      dir = -dir;
      if (dir==1) {
        start=0;
        end=points+1
      } // one extra here makes sure we connect the
      else        {
        start=points+1;
        end=0
      }
      for (i=start; (dir==1 ? i < end : i > end); i=i+dir)
      {
        theta = Math.PI * (i / (points/2));
        ex = point.lat() + (rlat * Math.sin(theta)); // center b + radius y * sin(theta)
        ey = point.lng() + (rlng * Math.cos(theta)); // center a + radius x * cos(theta)
        if ((dir === -1 && ey < 0) || (dir === 1 && ey > 0)) {
          ey = 0;
          isNearPrimaryMeridian = true;
        }
        extp.push(new google.maps.LatLng(ex, ey));
      }
      ret.push(extp);
    }
    return ret;
  }

  /**
    * The Overlay
    * Thanks Sammy Hubner (http://www.linkedin.com/in/sammyhubner) for providing me these awesome code
    *
    */

  InvertedCircle.prototype.Overlay = function () {
    var latExtent = 86;
    var lngExtent = 180;
    var lngExtent2 = lngExtent - 1e-10;
    return [
    [
    new google.maps.LatLng(-latExtent, -lngExtent),  // left bottom
    new google.maps.LatLng(latExtent, -lngExtent),   // left top
    new google.maps.LatLng(latExtent, 0),            // right top
    new google.maps.LatLng(-latExtent, 0),           // right bottom
    ], [
    new google.maps.LatLng(-latExtent, lngExtent2),  // right bottom
    new google.maps.LatLng(latExtent, lngExtent2),   // right top
    new google.maps.LatLng(latExtent, 0),            // left top
    new google.maps.LatLng(-latExtent, 0),           // left bottom
    ]
    ];
  }

  /**
    * This is draw circle
    * Thanks Sammy Hubner (http://www.linkedin.com/in/sammyhubner) for providing me these awesome code
    * @private
    */
  InvertedCircle.prototype.drawCircle_ = function(map, center, radius){

    var paths = new this.Overlay;

    var spot = this.drawSpot_(center, radius);
    for (var i = 0; i < spot.length; i++) {
      paths.push(spot[i]);
    }

    var donut = new google.maps.Polygon({
      strokeWeight: this.stroke_weight,
      strokeColor: this.stroke_color,
      fillColor: this.fill_color,
      fillOpacity: this.fill_opacity,
      map: map
    });

    this.set('paths', paths);
    this.set('donut', donut);
    if(this.getVisible())
      this.get('donut').setPaths(paths);
    var me = this;
    this.get('donut').addListener('click', function() {
      me.addressOverlay.close();
      me.get('clicked_event')();
    });
  }

  window.InvertedCircle = InvertedCircle;
}
