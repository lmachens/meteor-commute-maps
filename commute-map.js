function CommuteMap(instance, options) {
  this.instance = instance;
  this.options = options;
}

CommuteMap.zoomIn = function() {
  this.instance.setZoom(this.instance.getZoom() + 1);
}

CommuteMap.zoomOut = function() {
  this.instance.setZoom(this.instance.getZoom() - 1);
}