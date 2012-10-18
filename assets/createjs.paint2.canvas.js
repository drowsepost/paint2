/*
* CreateJS Paint2
* https://github.com/canotun/paint2
* Copyright (c) 2012 drowsepost.com
* required CreateJS 0.5.x
*
* based EaselJS "CurveTo" Sample script.
* by Copyright (c) 2010 gskinner.com, inc.
*
* MIT License
*/

/*
rev 2012/10/09
todo:
[debug]sort the layer,
[required]save the data,
[required]user interface,
[low priority]select the Rectangle,
[low priority]move the selection
*/

if(typeof paint2 === "undefined"){
function paint2(){
	var self = this; //Registers a namespace.
	
	var canvas;
	var canvas_ctx;
	
	var stage;
	var currentShape;
	
	var selectedColor;
	var selectedTool;
	
	var editlog;
	
	/* basic functions */
	
	// by econosys system http://logic.moo.jp/data/archives/765.html
	var isset = function( data ){
		return ( typeof( data ) != 'undefined' );
	};
	
	// by memory_agape http://d.hatena.ne.jp/memory_agape/20120203/1328245142
	var extend = function(){
		for(var d={},b=0,a=0,c=arguments.length; b<c; b++){
			for(a in arguments[b]){
				d[a]=arguments[b][a];
			}
		}
		return d;
	};
	
	/* mouse ivents */
	var handleMouseMove = function(event) {
		selectedTool.mousemove(event);
	};
	
	var handleMouseDown = function(event) {
		selectedTool.mousedown(event);
	};
	
	var handleMouseUp = function(event) {
		selectedTool.mouseup(event);
	};
	var handleMouseOut = function(event) {
		selectedTool.mouseout(event);
	};
	
	/* tool */
	var EditTool = function(name){
		this.name = name;
	};
	EditTool.prototype = {
		name : "tool",
		stroke : false,
		busy : false,
		oldX : 0,
		oldY : 0,
		oldMidX : 0,
		oldMidY : 0,
		size : 10,
		mousemove : function(event) {
			var pt = new createjs.Point(event.rawX, event.rawY);
			var midpt = new createjs.Point(this.oldX + pt.x>>1, this.oldY+pt.y>>1);
			if (this.busy) {
				this.stroke = true;
				this.move(pt,midpt);
			}
			this.oldX = pt.x;
			this.oldY = pt.y;
			this.oldMidX = midpt.x;
			this.oldMidY = midpt.y;
		},
		mousedown :  function(event) {
			var pt = new createjs.Point(event.rawX, event.rawY);
			this.stroke = false;
			this.busy = true;
			this.count = 0;
			
			this.start(pt);
			
			this.oldX = pt.x;
			this.oldY = pt.y;
			this.oldMidX = pt.x;
			this.oldMidY = pt.y;
		},
		mouseup : function() {
			if(this.busy){
				this.end();
				
				this.busy = false;
				stage.update();
				editlog.logging();
			}
		},
		mouseout : function() {
			layerdraw(true);
		},
		move : function(pt,midPoint) {
			currentShape.graphics.moveTo(midPoint.x, midPoint.y).curveTo(this.oldX, this.oldY, this.oldMidX, this.oldMidY);
		},
		start : function(pt) {
			var g = currentShape.graphics;
			g.setStrokeStyle(this.size, 'round', 'round').beginStroke(selectedColor);
		},
		end : function() {
			var g = currentShape.graphics;
			if(!this.stroke){
				g.beginFill(selectedColor).drawCircle(this.oldX, this.oldY, 1).endFill();
			}
			g.endStroke();
			
			currentShape.updateCache("source-overlay");
			g.clear();
		},
		tick : function() {
			if(this.busy){
				self.layer.draw(true);
			}
		}
	};
	
	/* layers */
	var LayerControl = function(color){
		this.bgcreate(color);
	};
	LayerControl.prototype = {
		data : [],
		order : [],
		cache : "",
		backgroundshape : {},
		draw : function(drawself){
			/*
			warning: draw function is advanced uses.
			http://www.createjs.com/Docs/EaselJS/Graphics.html#method_draw
			*/
			this.backgroundshape.draw(canvas_ctx);
			for (var i = 0 ; loopedlayer = this.data[this.order[i]]; i++){
				loopedlayer.draw(canvas_ctx);
				if((currentShape.layerid==this.order[i])&&(drawself)){
					loopedlayer.draw(canvas_ctx,true);
				}
			}
		},
		sort : function(){
			stage.addChild(this.backgroundshape);
			for (var i = 0 ; loopedlayer = this.data[this.order[i]]; i++){
				stage.addChild(loopedlayer);
			}
			stage.update();
		},
		add : function() {
			var s = new createjs.Shape();
			var lid = stage.getNumChildren();
			s.cache(0,0,canvas.width,canvas.height);
			s.layerid = this.data.length;
			s.name = "Layer"+s.layerid;
			s.snapToPixel=true;
			s.compositeOperation="source-overlay";
			this.order.push(s.layerid);
			this.data.push(stage.addChild(s));
			return s;
		},
		select : function(layer_id) {
			if(isset(this.data[layer_id])){
				currentShape = this.data[layer_id];
				this.cache = currentShape.getCacheDataURL();
				return true;
			}else{
				return false;
			}
		},
		load : function(layer_id,base64data) {
			var targetLayer = this.data[layer_id];
			var workimage = new Image();
			workimage.src = base64data;
			workimage.onload = function(){
				targetLayer.graphics.beginBitmapFill(workimage).drawRect(0, 0, canvas.width, canvas.height).endFill();
				targetLayer.updateCache();
				targetLayer.graphics.clear();
				stage.update();
			}
			this.sort;
		},
		bgcreate : function(color){
			var bg = new createjs.Shape();
			var defaultcolor = "rgba(255,255,255,1)";
			if(isset(color)){
				defaultcolor = color;
			}
			
			bg.name = "background";
			bg.cache(0,0,canvas.width,canvas.height);
			bg.graphics.beginFill(defaultcolor).drawRect(0, 0, canvas.width, canvas.height).endFill();
			bg.updateCache();
			bg.graphics.clear();
			this.backgroundshape = stage.addChild(bg);
			return this.backgroundshape;
		}
	};
	
	/* log */
	var LogControl = function(max){
		if(isFinite(max)){
			this.undomax = max | 0;
		}
	};
	LogControl.prototype = {
		data : [],
		undomax : 10,
		undocount : 0,
		logging : function(label){
			var cachedata = currentShape.getCacheDataURL();
			var layercache;
			
			//log setup
			if(!isset(label)){
				label=selectedTool.name;
			}
			
			if(this.data.length > 0){
				var prevdata = this.data[(this.data.length-1)];
				if(prevdata.layer == currentShape.layerid){
					layercache = undefined;
				}else{
					layercache = self.layer.cache;
				}
			}
			
			//logging
			if(this.undocount>0){
				this.data = this.data.slice(0,(this.data.length - this.undocount));
				this.undocount=0;
			}
			
			this.data.push({
				"label" : label,
				"layer" : currentShape.layerid,
				"b64" : cachedata,
				"layercache" : layercache,
				"layerorder" : self.layer.order
			});
			
			if(this.data.length > this.undomax){
				this.data.shift();
			}
			
			return (this.data.length-1);
		},
		load : function(logpoint,undo){
			var targetLog = this.data[logpoint];
			var layercache;
			
			if((logpoint < (this.data.length-1))&&(undo===true)){
				layercache = this.data[(logpoint+1)]["layercache"];
			}
			
			if(isset(layercache)){
				targetLog = this.data[(logpoint+1)];
				self.layer.load(targetLog.layer,layercache);
			}else{
				self.layer.load(targetLog.layer,targetLog.b64);
			}
			
			return targetLog.step;
		},
		undo : function(){
			var logpoint=(this.data.length-1)-(this.undocount+1);
			
			if(logpoint>=0){
				this.undocount++;
				return this.load(logpoint,true);
			}else{
				return false;
			}
		},
		redo : function(){
			var logpoint=(this.data.length-1)-(this.undocount-1);
			
			if((logpoint>0)&&(this.undocount>0)){
				this.undocount--;
				return this.load(logpoint,false);
			}else{
				return false;
			}
		}
	};
	
	/* pen */
	var penTool = new EditTool('pen');
	var eraserTool = new EditTool('eraser');
	eraserTool.start = function(pt) {
		var g = currentShape.graphics;
		g.setStrokeStyle(this.size, 'round', 'round').beginStroke("rgba(0,0,0,0.5)");
	};
	eraserTool.end = function() {
		if(!this.stroke){
			currentShape.graphics.drawCircle(this.oldX, this.oldY, 1);
		}
		currentShape.updateCache("destination-out");
		currentShape.graphics.endStroke().clear();
	};
	eraserTool.tick = function() {
		currentShape.updateCache("destination-out");
		self.layer.draw(false);
	};
	
	/* undo/redo */
	self.undo = function(){
		return editlog.undo();
	};
	
	self.redo = function(){
		return editlog.redo();
	};
	
	/* tool select */
	self.toolSelect = function(toolname){
		switch(toolname){
			case "eraser":
				selectedTool = eraserTool;
				break;
			default:
				selectedTool = penTool;
				break;
		}
		return true;
	};
	
	/* color and size */
	self.toolSize = function(setsize){
		if(isset(setsize)){
			selectedTool.size = setsize;
			return selectedTool.size;
		}else{
			return selectedTool.size;
		}
	};
	
	self.toolColor = function(setcolor){
		if(isset(setcolor)){
			selectedColor = setcolor;
			return selectedColor;
		}else{
			return selectedColor;
		}
	};
	
	/* timeline ivents */
	self.tick = function(event) {
		selectedTool.tick();
	};
	self.stop = function() {
		createjs.Ticker.removeListener(self);
	};
	
	self.init = function(element_id) {
		//get context of canvas
		canvas = document.getElementById(element_id);
		canvas_ctx = canvas.getContext("2d");
		
		//create stage
		stage = new createjs.Stage(canvas);
		stage.snapToPixelEnabled = true;
		stage.mouseMoveOutside = true;
		stage.autoClear = true;
		
		//create workspace
		self.layer = new LayerControl();
		currentShape = self.layer.add();
		
		editlog = new LogControl(20);
		editlog.logging('new');
		
		self.toolSelect('pen');
		self.toolColor("rgba(120,180,185,0.5)");
		self.toolSize(5);
		
		//edit start
		stage.onMouseDown = handleMouseDown;
		stage.onMouseUp = handleMouseUp;
		stage.onMouseMove = handleMouseMove;
		stage.onMouseOut = handleMouseOut;
		stage.update();
		
		createjs.Touch.enable(stage);
		createjs.Ticker.addListener(self);
	};
	
}

}
