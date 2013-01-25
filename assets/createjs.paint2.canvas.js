/*
* CreateJS Paint2
* https://github.com/canotun/paint2
* Copyright (c)drowsepost.com
* required CreateJS 0.5.x
*
* MIT License
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
	
	/* prototypes */
	/* tool */
	var EditTool = function(name){
		this.name = name;
	};
	EditTool.prototype = {
		name : "tool",
		compositeOperation : "source-over",
		size : 10,
		oldpt : {
			x: 0,
			y: 0
		},
		stroke : false,
		busy : false,
		mousemove : function(event) {
			var pt = new createjs.Point(event.rawX, event.rawY);
			if (this.busy) {
				this.stroke = true;
				this.move(pt,this.oldpt);
			}
			this.oldpt = pt.clone();
		},
		mousedown :  function(event) {
			var pt = new createjs.Point(event.rawX, event.rawY);
			this.stroke = false;
			this.busy = true;
			
			this.start(pt,this.oldpt);
			this.oldpt = pt.clone();
		},
		mouseup : function() {
			if(this.busy){
				this.end(this.oldpt);
				
				this.busy = false;
				stage.update();
				self.log.add();
			}
		},
		move : function(pt,oldpt) {
			currentShape.graphics.moveTo(oldpt.x, oldpt.y).lineTo(pt.x, pt.y);
		},
		start : function(pt,oldpt) {
			var g = currentShape.graphics;
			g.setStrokeStyle(this.size, 'round', 'round').beginStroke(selectedColor);
		},
		end : function(pt) {
			var g = currentShape.graphics;
			if(!this.stroke){
				g.beginFill(selectedColor).drawCircle(pt.x, pt.y, 1).endFill();
			}
			g.endStroke();
			
			currentShape.updateCache(this.compositeOperation);
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
		this.bginit(color);
		this.work_ctx = this.workinit().cacheCanvas.getContext("2d");
	};
	LayerControl.prototype = (function(){
		var data = [],
			backgroundshape = {},
			workshape = {};
		
		return {
			b64cache : "",
			order : [],
			work_ctx : {},
			draw : function(drawself){
				/*
				generate preview
				warning: draw function is advanced uses.
				http://www.createjs.com/Docs/EaselJS/Graphics.html#method_draw
				*/
				
				//generate active shape on the work area
				if(drawself){
					this.work_ctx.globalCompositeOperation = "copy";
					currentShape.draw(this.work_ctx);
					this.work_ctx.globalCompositeOperation = selectedTool.compositeOperation;
					currentShape.draw(this.work_ctx,true);
				}
				
				//output
				var loopedlayer;
				backgroundshape.draw(canvas_ctx);
				for (var i = 0 ; loopedlayer = data[this.order[i]]; i++){
					canvas_ctx.globalCompositeOperation = loopedlayer.compositeOperation;
					if((currentShape.layerid==this.order[i])&&(drawself)){
						workshape.draw(canvas_ctx);
					}else{
						loopedlayer.draw(canvas_ctx);
					}
				}
			},
			sort : function(){
				if(arguments[0] instanceof Array){
					order = arguments[0];
				}
				
				var loopedlayer;
				stage.addChild(backgroundshape);
				for (var i = 0 ; loopedlayer = data[this.order[i]]; i++){
					stage.addChild(loopedlayer);
				}
				stage.update();
			},
			add : function() {
				var s = new createjs.Shape();
				var lid = stage.getNumChildren();
				s.cache(0,0,canvas.width,canvas.height);
				s.layerid = data.length;
				s.name = "Layer"+s.layerid;
				s.snapToPixel=true;
				s.compositeOperation="source-over";
				this.order.push(s.layerid);
				data.push(stage.addChild(s));
				return s;
			},
			select : function(layer_id) {
				if(isset(data[layer_id])){
					currentShape = data[layer_id];
					this.b64cache = currentShape.getCacheDataURL();
					return true;
				}else{
					return false;
				}
			},
			load : function(layer_id,base64data) {
				var targetLayer = data[layer_id];
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
			bginit : function(color){
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
				backgroundshape = stage.addChild(bg);
				return backgroundshape;
			},
			workinit : function(){
				var work = new createjs.Shape();
				work.name = "workarea";
				work.visible = false;
				work.cache(0,0,canvas.width,canvas.height);
				workshape = stage.addChild(work);
				return workshape;
			}
		};
	})();
	
	/* log */
	var LogControl = function(max){
		if(isFinite(max)){
			this.undomax = max | 0;
		}
	};
	LogControl.prototype = (function(){
		var data = [],
			undocount = 0;
		
		return {
			undomax : 10,
			add : function(label){
				var cachedata = currentShape.getCacheDataURL();
				var layercache;
				
				//log setup
				if(!isset(label)){
					label=selectedTool.name;
				}
				
				if(data.length > 0){
					var prevdata = data[(data.length-1)];
					if(prevdata.layer == currentShape.layerid){
						layercache = undefined;
					}else{
						layercache = self.layer.b64cache;
					}
				}
				
				//logging
				if(undocount>0){
					data = data.slice(0,(data.length - undocount));
					undocount=0;
				}
				
				data.push({
					"label" : label,
					"layer" : currentShape.layerid,
					"b64" : cachedata,
					"layercache" : layercache,
					"layerorder" : self.layer.order
				});
				
				if(data.length > this.undomax){
					data.shift();
				}
				
				return (data.length-1);
			},
			load : function(logpoint,undo){
				var targetLog = data[logpoint];
				var layercache;
				
				if((logpoint < (data.length-1))&&(undo===true)){
					layercache = data[(logpoint+1)]["layercache"];
				}
				
				if(isset(layercache)){
					targetLog = data[(logpoint+1)];
					self.layer.load(targetLog.layer,layercache);
				}else{
					self.layer.load(targetLog.layer,targetLog.b64);
				}
				
				return targetLog.step;
			},
			undo : function(){
				var logpoint=(data.length-1)-(undocount+1);
				
				if(logpoint>=0){
					undocount++;
					return this.load(logpoint,true);
				}else{
					return false;
				}
			},
			redo : function(){
				var logpoint=(data.length-1)-(undocount-1);
				
				if((logpoint>0)&&(undocount>0)){
					undocount--;
					return this.load(logpoint,false);
				}else{
					return false;
				}
			}
		};
	})();
	
	/* pen */
	self.penTool = new EditTool('pen');
	self.eraserTool = new EditTool('eraser');
	self.eraserTool.compositeOperation = "destination-out";
	
	/* tool select */
	self.toolSelect = function(toolname){
		switch(toolname){
			case "eraser":
				selectedTool = self.eraserTool;
				break;
			default:
				selectedTool = self.penTool;
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
		
		self.log = new LogControl(20);
		self.log.add('new');
		
		self.toolSelect('pen');
		self.toolColor("rgba(120,180,185,0.5)");
		self.toolSize(15);
		
		//edit start
		stage.onMouseDown = handleMouseDown;
		stage.onMouseUp = handleMouseUp;
		stage.onMouseMove = handleMouseMove;
		stage.update();
		
		createjs.Touch.enable(stage);
		createjs.Ticker.setFPS(30);
		createjs.Ticker.addListener(self);
	};
	
};

}
