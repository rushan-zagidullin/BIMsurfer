window.BIMSERVER_VERSION = "1.5";

define(["./Notifier", "./BimServerModel", "./BimServerModelLoader", "./PreloadQuery", "./BimServerGeometryLoader", "./xeoViewer/xeoViewer", "./EventHandler"], function (Notifier, Model, ModelLoader, PreloadQuery, GeometryLoader, xeoViewer, EventHandler, _BimServerApi) {
	
    // Backwards compatibility
    var BimServerApi;
    if (_BimServerApi) {
		BimServerApi = _BimServerApi;
	} else {
        BimServerApi = window.BimServerClient;
	}
    
    function BimSurfer(cfg) {

        var self = this;

        EventHandler.call(this);

        cfg = cfg || {};

        var viewer = this.viewer = new xeoViewer(cfg);

        /**
         * Fired whenever this BIMSurfer's camera changes.
         * @event camera-changed
         */
        viewer.on("camera-changed", function() {
           self.fire("camera-changed", arguments);
        });

        /**
         * Fired whenever this BIMSurfer's selection changes.
         * @event selection-changed
         */
        viewer.on("selection-changed", function() {
            self.fire("selection-changed", arguments);
        });
        
        // This are arrays as multiple models might be loaded or unloaded.
        this._idMapping = {
            'toGuid': [],
            'toId'  : []
        };

        /**
         * Loads a model into this BIMSurfer.
         * @param params
         */
        this.load = function (params) {
            if (params.test) {
                viewer.loadRandom(params);
                return null;

            } else if (params.bimserver) {
                return this._loadFromServer(params);

            } else if (params.api) {
                return this._loadFromAPI(params);

            } else if (params.src) {
                return this._loadFrom_glTF(params);
            }
        };

        this._loadFromServer = function (params) {

            var notifier = new Notifier();
            var bimServerApi = new BimServerApi(params.bimserver, notifier);
			
			params.api = bimServerApi; // TODO: Make copy of params

            return self._initApi(params)
				.then(self._loginToServer)
				.then(self._getRevisionFromServer)
				.then(self._loadFromAPI);
        };
		
		this._initApi = function(params) {
			return new Promise(function(resolve, reject) {
				params.api.init(function () {
					resolve(params);
				});
			});
		};
		
		this._loginToServer = function (params) {
			return new Promise(function(resolve, reject) {
				if (params.token) {
					params.api.setToken(params.token, function() {
						resolve(params)
					}, reject);
				} else {
					params.api.login(params.username, params.password, function() {
						resolve(params)
					}, reject);
				}
			});
		};
		
		this._getRevisionFromServer = function (params) {
			return new Promise(function(resolve, reject) {
				if (params.roid) {
					resolve(params);
				} else {
					params.api.call("ServiceInterface", "getAllRelatedProjects", {poid: params.poid}, function(data) {
                        var resolved = false;
                        
                        data.forEach(function(projectData) {
                            if (projectData.oid == params.poid) {
                                params.roid = projectData.lastRevisionId;
                                params.schema = projectData.schema;
                                if (!self.models) {
                                    self.models = [];
                                }
                                self.models.push(projectData);
                                resolved = true;
                                resolve(params);
                            }
                        });
                        
                        if (!resolved) {
							reject();
						}
					}, reject);
				}
			});
		};

        this._loadFrom_glTF = function (params) {
            if (params.src) {
                var maxActiveProcessesEncountered = 0;
                var oldProgress = 0;
                return new Promise(function (resolve, reject) {
                    var m = viewer.loadglTF(params.src);
                    m.on("loaded", function() {						
						viewer.scene.canvas.spinner.on('processes', function(n) {
							if (n === 0) {
                                viewer.viewFit({});
                                resolve(m);
                            }
                            if (n > maxActiveProcessesEncountered) {
                                maxActiveProcessesEncountered = n;
                            }
                            var progress = parseInt((maxActiveProcessesEncountered - n) * 100 / maxActiveProcessesEncountered);
                            if (oldProgress != progress) {
                                self.fire("progress", [progress]);
                            }
                            oldProgress = progress;
						});                        
                    });
                });
            }
        };

        this._loadFromAPI = function (params) {
            var modelLoader = new ModelLoader(params.api, self);
            return modelLoader.loadFullModel(params.api.getModel(params.poid, params.roid, params.schema, false));
        };

        /**
         * Shows/hides objects specified by id or entity type, e.g IfcWall.
         *
         * When recursive is set to true, hides children (aggregates, spatial structures etc) or
         * subtypes (IfcWallStandardCase ⊆ IfcWall).
         *
         * @param params
         */
        this.setVisibility = function (params) {
            viewer.setVisibility(params);
        };

        /**
         * Selects/deselects objects specified by id.
         **
         * @param params
         */
        this.setSelection = function (params) {
            return viewer.setSelection(params);
        };

        /**
         * Gets a list of selected elements.
         */
        this.getSelection = function () {
            return viewer.getSelection();
        };

        /**
         * Sets color of objects specified by ids or entity type, e.g IfcWall.
         **
         * @param params
         */
        this.setColor = function (params) {
            viewer.setColor(params);
        };
		
		/**
         * Sets opacity of objects specified by ids or entity type, e.g IfcWall.
         **
         * @param params
         */
        this.setOpacity = function (params) {
            viewer.setOpacity(params);
        };

        /**
         * Fits the elements into view.
         *
         * Fits the entire model into view if ids is an empty array, null or undefined.
         * Animate allows to specify a transition period in milliseconds in which the view is altered.
         *
         * @param params
         */
        this.viewFit = function (params) {
            viewer.viewFit(params);
        };

        /**
         *
         */
        this.getCamera = function () {
            return viewer.getCamera();
        };

        /**
         *
         * @param params
         */
        this.setCamera = function (params) {
            viewer.setCamera(params);
        };
		
		/**
         * Redefines light sources.
         * 
         * @param params Array of lights {type: "ambient"|"dir"|"point", params: {[...]}}
		 * See http://xeoengine.org/docs/classes/Lights.html for possible params for each light type
         */
		this.setLights = function (params) {
			viewer.setLights(params);
		};
		
		
        /**
         * Returns light sources.
         * 
         * @returns Array of lights {type: "ambient"|"dir"|"point", params: {[...]}}
         */
		this.getLights = function () {
			return viewer.getLights;
		};

        /**
         *
         * @param params
         */
        this.reset = function (params) {
            viewer.reset(params);
        }
        
         /**
          * Returns a list of loaded IFC entity types in the model.
          * 
          * @method getTypes
          * @returns {Array} List of loaded IFC entity types, with visibility flag
          */
        this.getTypes = function() {
            return viewer.getTypes();
        };

        /**
         * Sets the default behaviour of mouse and touch drag input
         *
         * @method setDefaultDragAction
         * @param {String} action ("pan" | "orbit")
         */
        this.setDefaultDragAction = function (action) {
            viewer.setDefaultDragAction(action);
        };

        /**
         * Returns the world boundary of an object
         *
         * @method getWorldBoundary
         * @param {String} objectId id of object
         * @param {Object} result Existing boundary object
         * @returns {Object} World boundary of object, containing {obb, aabb, center, sphere} properties. See xeogl.Boundary3D
         */
        this.getWorldBoundary = function(objectId, result) {
            return viewer.getWorldBoundary(objectId, result);
        };

       /**
         * Destroys the BIMSurfer
         */
        this.destroy = function() {
            viewer.destroy();
        }
    }

    BimSurfer.prototype = Object.create(EventHandler.prototype);

    return BimSurfer;

});
