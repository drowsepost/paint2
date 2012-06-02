/*
* EaselJS Paint2
* Copyright (c) 2012 drowsepost.com
* required CreateJS 0.4.2 and up
*
* based EaselJS "CurveTo" Sample script.
* by Copyright (c) 2010 gskinner.com, inc.
*
* MIT License
*/

if(typeof paint2 === "undefined"){
function paint2(){
	var self = this;
	var logMax=20;
	
	//private
	var canvas;
	var canvas_ctx;
	
	var stage;
	var backgroundShape;
	var currentShape;
	var cursor;
	
	var isMouseDown;
	var oldMidX;
	var oldMidY;
	var oldX;
	var oldY;
	
	var pensize;
	var selectedColor;
	var selectedTool;
	
	var Layers;
	var LayerCache;
	
	var isEditStarted;
	var undoCount;
	
	
	self.editlog;
	
	self.init = function(element_id) {
		canvas = document.getElementById(element_id);
		canvas.onselectstart = function () { return false; } // ie
		canvas.onmousedown = function () { return false; } // mozilla
		canvas_ctx = canvas.getContext("2d");
		
		stage = new Stage(canvas);
		stage.autoClear = true;
		stage.snapToPixelEnabled = true;
		//stage.enableMouseOver(10);
		
		stage.onMouseDown = handleMouseDown;
		stage.onMouseUp = handleMouseUp;
		stage.onMouseMove = handleMouseMove;
		stage.onMouseOut = handleMouseOut;
		
		backgroundShape = self.newBG();
		
		Layers = new Array();
		currentShape = self.newLayer();
		
		editLogging('new');
		
		self.toolSelect('pen');
		self.penColor("rgba(120,180,185,0.5)");
		self.penSize(10);
		
		//Ticker.setFPS(30);
		//Ticker.addListener(window);
		Touch.enable(stage);
		stage.update();
	};
	
	var handleMouseMove = function(e) {
		
		var pt = new Point(stage.mouseX, stage.mouseY);
		var midpt = new Point(oldX + pt.x>>1, oldY+pt.y>>1);
		if (isMouseDown) {
			selectedTool.mousemove(pt,midpt);
			oldX = pt.x;
			oldY = pt.y;
			oldMidX = midpt.x;
			oldMidY = midpt.y;
		}else{
			moveCur(cursor);
			stage.update();
		}
	};

	var handleMouseDown = function(e) {
		cursor.visible = false;
		
		isMouseDown = true;
		isEditStarted = true;
		
		var pt = new Point(stage.mouseX, stage.mouseY);
		oldX = pt.x;
		oldY = pt.y;
		oldMidX = pt.x;
		oldMidY = pt.y;
		selectedTool.mousedown(pt);
	};

	var handleMouseUp = function() {
		isMouseDown = false;
		if(isEditStarted){
			isEditStarted = false;
			selectedTool.mouseup();
			stage.update();
			editLogging();
		}
	};
	
	var handleMouseOut = function() {
		cursor.visible = false;
		layerdraw(true);
	}
	
	var moveCur = function(shape) {
		shape.visible = true;
		shape.x = stage.mouseX;
		shape.y = stage.mouseY;
	};
	
	/*ui*/
	var createCursor = function(type,size,shape) {
		if((typeof(shape) != 'function')&&(typeof(shape) != 'object')){
			shape = new Shape();
			shape.name = "cur";
			return stage.addChild(drawCursor(shape,type,size));
		}else{
			shape.uncache();
			return drawCursor(shape,type,size);
		}
	};
	
	var drawCursor = function(shape,type,size) {
		var g = shape.graphics;
		g.setStrokeStyle(1, 'round', 'round');
		shape.cache(-(size/2),-(size/2),size+2,size+2);
		switch(type){
			case "eraser":
				g.beginFill('rgba(255,255,255,0.5)');
				g.setStrokeStyle(1, 'round', 'round');
				g.beginStroke("rgba(0,0,0,0.5)");
				g.drawCircle(1,1,size/2);
				break;
			default:
				g.beginFill(selectedColor);
				g.setStrokeStyle(1, 'round', 'round');
				g.beginStroke("rgba(255,255,255,1)");
				g.drawCircle(1,1,size/2);
				break;
		}
		shape.updateCache();
		g.clear();
		return shape;
	};
	
	/* layers */
	var layerdraw = function(drawself){
		stage.update();
		/* warning: this function call lowlevel function.*/
		backgroundShape.draw(canvas_ctx);
		for (var i = 0 ; loopedlayer = Layers[i] ; i++){
			loopedlayer.draw(canvas_ctx);
			if((currentShape.layerid==i)&&(drawself)){
				loopedlayer.draw(canvas_ctx,true);
			}
		}
	};
	
	self.newBG = function(){
		var bg = new Shape();
		bg.name = "background";
		bg.cache(0,0,canvas.width,canvas.height);
		bg.graphics.beginFill("rgba(255,255,255,1)");
		bg.graphics.drawRect(0, 0, canvas.width, canvas.height);
		bg.graphics.endFill();
		bg.updateCache();
		bg.graphics.clear();
		return stage.addChild(bg);
	}
	
	self.newLayer = function() {
		var s = new Shape();
		var lid = stage.getNumChildren();
		s.name = "Shape"+lid;
		s.layerid = Layers.length;
		s.cache(0,0,canvas.width,canvas.height);
		s.compositeOperation="source-overlay";
		Layers.push(stage.addChild(s));
		return s;
	};
	
	self.selectLayer = function(layer_id) {
		currentShape = Layers[layer_id];
		LayerCache = currentShape.getCacheDataURL();
	};
	
	/* log */
	var editLogging = function(label){
		var cachedata = currentShape.getCacheDataURL();
		var prevdata;
		var l_layercache;
		
		//log setup
		if(!isset(label)){
			label=selectedTool.name;
		}
		
		if(!isset(self.editlog)){
			self.editlog = new Array();
			undoCount=0;
		}else{
			prevdata = self.editlog[(self.editlog.length-1)];
			if(prevdata.layer == currentShape.layerid){
				l_layercache = undefined;
			}else{
				l_layercache = LayerCache;
			}
		}
		
		//logging
		if(undoCount>0){
			self.editlog = self.editlog.slice(0,(self.editlog.length-undoCount));
			undoCount=0;
		}
		
		self.editlog.push({
			"label":label,
			"layer":currentShape.layerid,
			"b64":cachedata,
			"layercache":l_layercache
		});
		
		if(self.editlog.length > logMax){
			self.editlog.shift();
		}
		
		return (self.editlog.length-1);
	};
	
	self.logset = function(logpoint,enablecache){
		var targetLog = self.editlog[logpoint];
		var layercache;
		if(!isset(enablecache)){
			enablecache=false;
		}
		
		if((logpoint < (self.editlog.length-1))&&(enablecache)){
			layercache = self.editlog[(logpoint+1)]['layercache'];
		}
		
		var workimage = new Image();
		if(isset(layercache)){
			workimage.src = layercache;
			targetLog = self.editlog[(logpoint+1)];
		}else{
			workimage.src = targetLog.b64;
		}
		
		workimage.onload = function(){
			Layers[targetLog.layer].graphics.beginBitmapFill(workimage);
			Layers[targetLog.layer].graphics.drawRect(0, 0, canvas.width, canvas.height);
			Layers[targetLog.layer].graphics.endFill();
			Layers[targetLog.layer].updateCache();
			Layers[targetLog.layer].graphics.clear();
			self.selectLayer(currentShape.layerid);
			stage.update();
		}
		
		return targetLog.step;
	};
	
	self.undo = function(){
		var logpoint=(self.editlog.length-1)-(undoCount+1);
		
		if(logpoint>=0){
			undoCount++;
			return self.logset(logpoint,true);
		}else{
			return false;
		}
	};
	
	self.redo = function(){
		var logpoint=(self.editlog.length-1)-(undoCount-1);
		
		if((logpoint>0)&&(undoCount>0)){
			undoCount--;
			return self.logset(logpoint);
		}else{
			return false;
		}
	};
	
	/* color and size */
	self.penSize = function(setsize){
		if(isset(setsize)){
			pensize = setsize;
			cursor = createCursor(selectedTool.name,pensize,cursor);
			return pensize;
		}else{
			return pensize;
		}
	};
	
	self.penColor = function(setcolor){
		if(isset(setcolor)){
			selectedColor = setcolor;
			cursor = createCursor(selectedTool.name,pensize,cursor);
			return selectedColor;
		}else{
			return selectedColor;
		}
	};
	
	self.toolSelect = function(toolname){
		switch(toolname){
			case "eraser":
				selectedTool = eraserTool;
				break;
			default:
				selectedTool = penTool;
				break;
		}
		cursor = createCursor(selectedTool.name,pensize,cursor);
		return true;
	};
	
	
	//pen
	var penTool = {
		name : "pen",
		mousemove : function(pt,midPoint) {
			currentShape.graphics.moveTo(midPoint.x, midPoint.y);
			currentShape.graphics.curveTo(oldX, oldY, oldMidX, oldMidY);
			layerdraw(true);
		},
		mousedown :  function(pt) {
			var g = currentShape.graphics;
			g.setStrokeStyle(pensize, 'round', 'round');
			g.beginStroke(selectedColor);
			g.beginFill();
		},
		mouseup : function() {
			currentShape.graphics.endFill();
			currentShape.graphics.endStroke();
			
			currentShape.updateCache("source-overlay");
			currentShape.graphics.clear();
		}
	};
	
	var eraserTool = {
		name : "eraser",
		mousemove : function(pt,midPoint) {
			currentShape.graphics.moveTo(midPoint.x, midPoint.y);
			currentShape.graphics.curveTo(oldX, oldY, oldMidX, oldMidY);
			
			currentShape.updateCache("destination-out");
			layerdraw(false);
		},
		mousedown :  function(pt) {
			var g = currentShape.graphics;
			g.setStrokeStyle(pensize, 'round', 'round');
			g.beginStroke("rgba(0,0,0,0.1)");
			g.beginFill();
		},
		mouseup : function() {
			currentShape.graphics.endFill();
			currentShape.graphics.endStroke();
			
			currentShape.graphics.clear();
		}
		
	};
	
	var isset = function( data ){
		return ( typeof( data ) != 'undefined' );
	}
	
}

}
